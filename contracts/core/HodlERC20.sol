//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/drafts/ERC20PermitUpgradeable.sol";
import {IERC20WithDetail} from "../interfaces/IERC20WithDetail.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * HodlShare contract locks up your ERC20 token for a specified period of time.
 * Any deposit will mint you a non-transferable hodlToken
 * which you can use to redeem your deposit. If ou redeem before expiry, you lose some amount to penalty.
 * The later you deposit, the less share you get. this is to reward early depositors and avoid last-second joining sharing the reward
 * 
 * You can withdraw anytime before expiry but you will get penalized. the penalty amount will go to the reward pool.
 */
contract HodlERC20 is ERC20PermitUpgradeable {
  using SafeERC20 for IERC20WithDetail;
  using SafeMath for uint256;

  IERC20WithDetail public token;

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

  /// @dev record each user's share to the pool. 
  mapping(address => uint256) internal _shares; 


  /**********************
   *       Events       *
   **********************/
  event Deposit(address depositor, uint256 amount);

  event Exit(address quitter, uint256 amountOut, uint256 reward, uint256 fee);

  event Withdraw(address recipient, uint256 amountOut);

  event Redeem(address recipient, uint256 shareBurned, uint256 reward);

  /**
   * @param _token address of the token of this hold contract
   * @param _penalty amount
   * @param _lockWindow period before expiry that lock the pool from deposit
   * @param _expiry timestamp in sec, after which the locking is over.
   * @param _name name of the token
   * @param _symbol symbol of the new token
   */
  function init(
    address _token, 
    uint256 _penalty, 
    uint256 _lockWindow, 
    uint256 _expiry, 
    uint256 _fee,
    address _feeRecipient, 
    string memory _name, 
    string memory _symbol
  ) external initializer {
    require(_penalty < BASE, "INVALID_PENALTY");
    require(block.timestamp + _lockWindow < _expiry, "INVALID_EXPIRY");

    totalTime = _expiry - block.timestamp;

    token = IERC20WithDetail(_token);
    feeRecipient = _feeRecipient;
    feePortion = _fee;
    penalty = _penalty;
    expiry = _expiry;

    __ERC20_init(_name, _symbol);

    // decimal of the share will be the same as the underlying token.
    uint8 decimals = token.decimals();
    _setupDecimals(decimals);
  }

  /**
   * get current share to the pool
   */
  function getShares(address _account) external view returns (uint256) {
    return _shares[_account];
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
    
    // mint hold token to the user
    _mint(msg.sender, _amount);
    
    // calculate shares and mint to msg.sender
    uint256 shares = _calculateShares(_amount);
    _shares[msg.sender] = _shares[msg.sender].add(shares);
  }

  /**
   * @dev exist from the pool pre expiry. Will revert if the pool is expired.
   * @notice a quitter can keep getting rewards by holding his shares.
   * @param _amount amount of token to exist
   */
  function exit(uint256 _amount) external {
    _exit(_amount);
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
   * this will burn your shares, and disable you from collecting rewards from later quitters from these shares.
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
   * @dev calculate how much share you can get by depositing {_amount} token
   * this will change based on {block.timestamp}
   */
  function calculateShares(uint256 _amount) external view returns (uint256) {
    return _calculateShares(_amount);
  }

  /**
   * @dev withdraw all fees.
   */
  function withdrawFee() external {
    require(msg.sender == feeRecipient, "NO_AUTHORIZED");

    uint256 feeToPay = totalFee;
    totalFee = 0;

    token.safeTransfer(msg.sender, feeToPay);
  }

  /**********************
   * Internal Functions *
   **********************/

  /**
   * @dev exit the pool before expiry. 
   * this will send fund back the user, and increase totalFee and total Reward
   * @param _amount amount to withdraw before penalty
   */
  function _exit(uint256 _amount) internal {
    require(block.timestamp < expiry, "EXPIRED");

    // this will revert if user is trying to call exit with amount more than his holdings.
    _burn(msg.sender, _amount);

    (uint256 payout, uint256 reward, uint256 fee) = _calculatePayout(_amount);
    
    // increase total in reward pool and fee pool.
    totalReward = totalReward.add(reward);
    totalFee = totalFee.add(fee);

    emit Exit(msg.sender, payout, reward, fee);

    token.safeTransfer(msg.sender, payout);
  }

  /**
   * @dev withdraw post expiry
   */
  function _withdraw(uint256 _amount) internal {
    require(block.timestamp >= expiry, "NOT_EXPIRED");
    
    _burn(msg.sender, _amount);

    emit Withdraw(msg.sender, _amount);

    token.safeTransfer(msg.sender, _amount);  
  }

  /**
   * @dev reduce user share and send reward based on current reward pool.
   */
  function _redeem(uint256 _share) internal {
    uint256 cachedPrecisionFactor = PRECISION_FACTOR;
    uint256 cachedTotalReward = totalReward;
    uint256 payout = cachedTotalReward
      .mul(cachedPrecisionFactor).mul(_share)
      .div(totalSupply()).div(cachedPrecisionFactor);
    
    // reduce total price recorded
    totalReward = cachedTotalReward.sub(payout);

    // transfer shares from user. this will revert if user don't have sufficient shares
    _shares[msg.sender] = _shares[msg.sender].sub(_share);

    emit Redeem(msg.sender, _share, payout);

    token.safeTransfer(msg.sender, payout);
  }

  /**
   * @dev calcualte how much of _amount can be taken out by user, how much to reward pool and how much to feeRecipient
   * @param _amount total amount requested to withdraw before expiry.
   */
  function _calculatePayout(uint256 _amount) internal view returns (uint256 payout, uint256 reward, uint256 fee) {
    uint256 cachedBase = BASE; // save SLOAD
    uint256 totalPenalty = _amount.mul(penalty).div(cachedBase);
    
    fee = totalPenalty.mul(feePortion).div(cachedBase);
    reward = totalPenalty.sub(fee);
    payout = _amount.sub(totalPenalty);

    // extra assertion to make sure user is not taking more than he's supposed to.
    require(payout.add(fee).add(reward) == _amount, "INVALID_OPERATION");
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

  /**
   * hook to prevent transfering the hodlToken
   */
  function _beforeTokenTransfer(address from, address to, uint256) internal override {
    require(from == address(0) || to == address(0), "!Transfer");
  }
}
