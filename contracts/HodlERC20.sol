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

  /// @notice penalty for withdraw 1000 token before expiry.
  uint256 public penalty;

  /// @notice the total duration from creation to expiry.
  uint256 public totalTime;

  /// @notice expiry after which everyone can take out their deposit without penality.
  uint256 public expiry;

  /// @notice duration in sec, during this period before expiry deposit will not be accepted.
  uint256 public lockWindow;

  /// @notice current reward share by all the share holders
  uint256 public totalReward;

  /// @dev scaling factor for penality
  uint256 internal constant PENALTY_BASE = 1000;

  /// @dev scaling factor for share calculation.
  uint256 internal constant PRECISION_FACTOR = 1e18;

  /// @dev the address that's previllged to rehypothecate the money in the poool
  address public governance;

  /// @dev record each user's deposit amount. 
  /// We can't make this an ERC20 otherwise people will be able to trade it in a secondary market
  mapping(address => uint256) internal _deposit; 

  /**
   * @param _token address of the token of this hold contract
   * @param _penalty amount
   * @param _lockWindow period before expiry that lock the pool from deposit
   * @param _expiry timestamp in sec, after which the locking is over.
   * @param _name name of the token
   * @param _symbol symbol of the new token
   */
  function init(address _token, uint256 _penalty, uint256 _lockWindow, uint256 _expiry, string memory _name, string memory _symbol) external {
    require(penalty < PENALTY_BASE, "INVALID_PENALTY");
    require(block.timestamp + _lockWindow < _expiry, "INVALID_EXPIRY");

    totalTime = _expiry - block.timestamp;

    token = IERC20WithDecimals(_token);
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
    
    _deposit[msg.sender] = _deposit[msg.sender].add(_amount);
    
    // calculate shares and mint to msg.sender
    uint256 shares = _calculateShares(_amount);
    _mint(msg.sender, shares);
  }

  /**
   * @dev get payout based on the current reward pool.
   * this will burn all your shares, and disable you from collecting rewards from later quiters.
   * @param _share shares to burn
   */
  function redeem(uint256 _share) external {
    _redeem(_share);
  }

  /**
   * calcualte how much share you can get by depositing {_amount} token
   */
  function calculateShares(uint256 _amount) external view returns (uint256) {
    return _calculateShares(_amount);
  }

  /**
   * @dev 
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

    // payout
    token.safeTransfer(msg.sender, payout);
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
