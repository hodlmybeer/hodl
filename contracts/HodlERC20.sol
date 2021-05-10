//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/drafts/ERC20PermitUpgradeable.sol";
import {IERC20WithDecimals} from "./interfaces/IERC20WithDecimals.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * HodlShare contract locks up your ERC20 token for a specified period of time.
 * Any deposit will mint you a share, which you can use once to get the "reward" from the common pool;
 * The later you deposit, the less share you get. this is to reward long time holders and avoid last-second joining sharing the prize
 * 
 * You can withdraw anytime before expiry but you will get penalized. the penalty amount will go to the prize pool.
 */
contract HodlShare is ERC20PermitUpgradeable {
  using SafeERC20 for IERC20WithDecimals;
  using SafeMath for uint256;

  IERC20WithDecimals public token;

  /// @notice penalty (3 decimals) for withdrawing before expiry. penalty of 20 == 2%
  uint256 public penalty;

  /// @notice feePortion (3 decimals) charged to feeRecipient before penalty going to the pool. fee of 100 == 10% of total penalty
  uint256 public feePortion;

  /// @notice total fee accumulated in this pool.
  uint256 public totalFee;

  /// @notice the total duration from creation to expiry.
  uint256 public totalTime;

  /// @notice expiry after which everyone can take out their deposit without penality.
  uint256 public expiry;

  /// @notice duration in sec, during this period before expiry deposit will not be accepted.
  uint256 public lockWindow;

  /// @notice current reward share by all the share holders
  uint256 public totalReward;

  /// @dev scaling factor for penalty and fee
  uint256 internal constant BASE = 1000;

  /// @dev scaling factor for share calculation.
  uint256 internal constant PRECISION_FACTOR = 1e18;

  /// @dev the address that collect fees from early quitter. ()
  address public feeRecipient;

  /// @dev record each user's deposit amount. 
  /// We can't make this an ERC20 otherwise people will be able to trade it in a secondary market
  mapping(address => uint256) internal _holding; 


  /// Events
  event Deposit(address depositor, uint256 amount);

  event Exit(address quitter, uint256 amountOut, uint256 prize, uint256 fee);

  event Withdraw(address recipient, uint256 amountOut);

  event Redeem(address recipient, uint256 shareBurned, uint256 amountPrize);

  /**
   * @param _token address of the token of this hold contract
   * @param _penalty amount
   * @param _lockWindow period before expiry that lock the pool from deposit
   * @param _expiry timestamp in sec, after which the locking is over.
   * @param _name name of the token
   * @param _symbol symbol of the new token
   */
  function init(address _token, uint256 _penalty, uint256 _lockWindow, uint256 _expiry, address _feeRecipient, string memory _name, string memory _symbol) external {
    require(penalty < BASE, "INVALID_PENALTY");
    require(block.timestamp + _lockWindow < _expiry, "INVALID_EXPIRY");

    totalTime = _expiry - block.timestamp;

    token = IERC20WithDecimals(_token);
    feeRecipient = _feeRecipient;
    penalty = _penalty;
    expiry = _expiry;

    __ERC20_init(_name, _symbol);

    // decimal of the share will be the same as the underlying token.
    uint8 decimals = token.decimals();
    _setupDecimals(decimals);
  }

  /**
   * @dev deposit token into the contract.
   * the deposit amount will be stored under the account.
   * the share you get is propotional to (time - expiry) / (start - expiry)
   * @param _amount amount of token to transfer into the Hodl contract
   */
  function deposit(uint256 _amount) external {
    require(block.timestamp + lockWindow < expiry, "LOCKED");
    
    token.safeTransferFrom(msg.sender, address(this), _amount);
    
    _holding[msg.sender] = _holding[msg.sender].add(_amount);
    
    // calculate shares and mint to msg.sender
    uint256 shares = _calculateShares(_amount);
    _mint(msg.sender, shares);
  }

  /**
   * @dev exist from the pool pre expiry. Will revert if the pool is expired.
   * @param _amount amount of token to exist
   */
  function exit(uint256 _amount) external {

  }

  /**
   * @dev withdraw post expiry. Will revert if the pool is not expired.
   * @param _amount amount of token to withdraw
   */
  function withdraw(uint256 _amount) external {
    _withdraw(_amount);
  }

  /**
   * @dev get payout based on the current reward pool.
   * this will burn your shares, and disable you from collecting rewards from later quiters from these shares.
   * @param _share shares to burn
   */
  function redeem(uint256 _share) external {
    _redeem(_share);
  }

  /**
   * @dev withdraw initial deposit + reward after expiry
   */
  function withdrawCapitalAndReward(uint256 _amount, uint256 _share) external {
    _withdraw(_amount);
    _redeem(_share);
  }

  /**
   * calcualte how much share you can get by depositing {_amount} token
   */
  function calculateShares(uint256 _amount) external view returns (uint256) {
    return _calculateShares(_amount);
  }

  //
  // Internal Functions
  // 

  /**
   * @dev exit the pool before expiry. 
   * this will send fund back the user, and increase totalFee and total Reward
   * 
   */
  function _exit(uint256 _amount) internal {
    require(block.timestamp < expiry, "EXPIRED");

    // this will revert if user is trying to call exit with amount more than his holdings.
    _holding[msg.sender] = _holding[msg.sender].sub(_amount);

    (uint256 payout, uint256 prize, uint256 fee) = _calculatePayout(_amount);
    
    // increase total in reward pool and fee pool.
    totalReward = totalReward.add(prize);
    totalFee = totalFee.add(fee);

    emit Exit(msg.sender, payout, prize, fee);

    token.safeTransfer(msg.sender, payout);
  }

  /**
   * @dev withdraw post expiry
   */
  function _withdraw(uint256 _amount) internal {
    require(block.timestamp >= expiry, "NOT_EXPIRED");

    uint256 cachedHolding = _holding[msg.sender];

    // this will revert if someone is trying to withdraw more than he has.
    _holding[msg.sender] = cachedHolding.sub(_amount);    

    emit Withdraw(msg.sender, _amount);

    token.safeTransfer(msg.sender, _amount);  
  }

  /**
   * @dev burn user share and send reward based on current reward pool.
   */
  function _redeem(uint256 _share) internal {
    uint256 cachePrecisionFactor = PRECISION_FACTOR;
    uint256 cacheTotalReward = totalReward;
    uint256 payout = cacheTotalReward
      .mul(cachePrecisionFactor).mul(_share)
      .div(totalSupply()).div(cachePrecisionFactor);
    
    // reduce total price recorded
    totalReward = cacheTotalReward.sub(payout);

    // transfer shares from user. this will revert if user don't have sufficient shares
    _burn(msg.sender, _share);

    emit Redeem(msg.sender, _share, payout);

    token.safeTransfer(msg.sender, payout);
  }

  /**
   * @dev calcualte how much of _amount can be taken out by user, how much to prize pool and how much to feeRecipient
   * @param _amount total amount requested to withdraw before expiry.
   */
  function _calculatePayout(uint256 _amount) internal view returns (uint256 payout, uint256 prize, uint256 fee) {
    uint256 cachedBase = BASE; // save SLOAD
    uint256 totalPenalty = _amount.mul(penalty).div(cachedBase);
    
    fee = totalPenalty.mul(feePortion).div(cachedBase);
    prize = totalPenalty.sub(fee);
    payout = _amount.sub(totalPenalty);

    // extra assertion to make sure user is not taking more than he's supposed to.
    require(payout.add(fee).add(prize) == _amount, "INVALID_OPERATION");
  }

  /**
   * @dev the share you get depositing _amount into the pool
   * 
   *                        (timeLeft)^2
   * share = amount * --------------------------
   *                      (total duration)^2
   */
  function _calculateShares(uint256 _amount) internal view returns (uint256) {
    uint256 timeLeft = expiry - block.timestamp;
    uint256 cachePrecisionFactor = PRECISION_FACTOR;
    return _amount.mul(timeLeft).mul(timeLeft).mul(cachePrecisionFactor).div(totalTime).div(totalTime).div(cachePrecisionFactor);
  }
}
