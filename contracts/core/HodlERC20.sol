//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/drafts/ERC20PermitUpgradeable.sol";
import {IERC20WithDetail} from "../interfaces/IERC20WithDetail.sol";
import {IHodlERC20} from "../interfaces/IHodlERC20.sol";
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
contract HodlERC20 is ERC20PermitUpgradeable, IHodlERC20 {
  using SafeERC20 for IERC20WithDetail;
  using SafeMath for uint256;

  IERC20WithDetail public token;

  /// @notice penalty (3 decimals) for withdrawing before expiry. penalty of 20 == 2%
  uint256 public penaltyPortion;

  /// @notice feePortion (3 decimals) charged to feeRecipient before penalty going to the pool. fee of 100 == 10% of total penalty
  uint256 public feePortion;

  /// @notice the total duration from creation to expiry.
  uint256 public totalTime;

  /// @notice expiry after which everyone can take out their deposit without penality.
  uint256 public expiry;

  /// @notice duration in sec, during this period before expiry deposit will not be accepted.
  uint256 public lockWindow;

    /// @notice total base token reward amount
  uint256 public totalReward;

  /// @notice total shares available to redeem
  uint256 public totalShares;

  /// @notice how fast shares you get decrease over time. 
  ///         when n = 0 there's no decay. n = 1: linear decay, n = 2 exponential decay
  uint256 public n;

  /// @dev scaling factor for penalty and fee
  uint256 internal constant BASE = 1000;

  /// @dev scaling factor for share calculation.
  uint256 internal constant PRECISION_FACTOR = 1e18;

  /// @dev the address that collect fees from early quitter. ()
  address public feeRecipient;

  /// @dev record each user's share to the pool. 
  mapping(address => uint256) internal _shares; 

  /// @notice extra token for donations, if different from base token 
  IERC20WithDetail public bonusToken;

  /// @notice total bonus token reward amount
  uint256 public totalBonusReward;

  /**********************
   *       Events       *
   **********************/
  event Deposit(address depositor, uint256 amount, uint256 shares);

  event Exit(address quitter, uint256 amountOut, uint256 reward, uint256 fee);

  event Withdraw(address recipient, uint256 amountOut);

  event Redeem(address recipient, uint256 shareBurned, uint256 reward, uint256 bonusReward);

  event Donate(address donator, uint256 amount, address token);

  /**
   * @param _token address of the token of this hold contract
   * @param _penalty amount
   * @param _lockWindow period before expiry that lock the pool from deposit
   * @param _expiry timestamp in sec, after which the locking is over.
   * @param _name name of the token
   * @param _symbol symbol of the new token
   * @param _bonusToken address of the bonus reward token (extra token for donations). Not required, set to zero address if using just the base token.
   */
  function init(
    address _token, 
    uint256 _penalty, 
    uint256 _lockWindow, 
    uint256 _expiry, 
    uint256 _fee,
    uint256 _n,
    address _feeRecipient, 
    string memory _name, 
    string memory _symbol,
    address _bonusToken
    ) external override initializer {
    require(_penalty < BASE, "INVALID_PENALTY");
    require(_fee < BASE, "INVALID_FEE");
    require(block.timestamp + _lockWindow < _expiry, "INVALID_EXPIRY");

    totalTime = _expiry - block.timestamp;

    token = IERC20WithDetail(_token);
    bonusToken = IERC20WithDetail(_bonusToken);
    feeRecipient = _feeRecipient;
    feePortion = _fee;
    penaltyPortion = _penalty;
    expiry = _expiry;
    lockWindow = _lockWindow;
    n = _n;

    __ERC20_init(_name, _symbol);

    // decimal of the share will be the same as the underlying token.
    uint8 decimals = token.decimals();
    _setupDecimals(decimals);
  }

  /**
   * @dev returns how much reward you get from burning {_share} amount of shares.
   */
  function rewardFromShares(uint256 _share) external view returns (uint256) {
    return _rewardFromShares(_share, totalReward);
  }

  /**
  * @dev returns how much bonus token you get from burning {_share} amount of shares.
  */
  function bonusFromShares(uint256 _share) external view returns (uint256) {
    return _rewardFromShares(_share, totalBonusReward);
  }

  /**
   * get current share to the pool
   */
  function shares(address _account) external view returns (uint256) {
    return _shares[_account];
  }

  /**
   * @dev deposit token into the contract.
   * the deposit amount will be stored under the account.
   * the share you get is proportional to (time - expiry) / (start - expiry)
   * @param _amount amount of token to transfer into the Hodl contract
   */
  function deposit(uint256 _amount) external {
    require(block.timestamp + lockWindow < expiry, "LOCKED");
    
    token.safeTransferFrom(msg.sender, address(this), _amount);
    
    // mint hold token to the user
    _mint(msg.sender, _amount);
    
    // calculate shares and mint to msg.sender
    uint256 sharesToMint = _calculateShares(_amount);
    
    totalShares = totalShares.add(sharesToMint);
    _shares[msg.sender] = _shares[msg.sender].add(sharesToMint);

    emit Deposit(msg.sender, _amount, sharesToMint);
  }

  /**
   * @dev exist from the pool before expiry. Reverts if the pool is expired.
   * @param _amount amount of token to exist
   */
  function quit(uint256 _amount) external {
    _quit(_amount);
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
  function withdrawAllPostExpiry() external {
    uint256 tokenAmount = balanceOf(msg.sender);
    _withdraw(tokenAmount);

    uint256 shareAmount = _shares[msg.sender];
    _redeem(shareAmount);
  }

  /**
   * @dev calculate how much shares you can get by depositing the {_amount} of token
   * this will change based on {block.timestamp}
   */
  function calculateShares(uint256 _amount) external view returns (uint256) {
    return _calculateShares(_amount);
  }

  /**
   * @dev donate asset to the reward pool (can be used by projects to reward holders)
   * @param _amount amount to donate
   * @param _token token to donate (can be either a base token or a bonus token that was set up during the initialization)
   */
    function donate(uint256 _amount, address _token) external {
        require(address(_token) == address(token) || address(_token) == address(bonusToken), "TOKEN_NOT_ALLOWED");
        if (address(_token) == address(token)) {
            token.safeTransferFrom(msg.sender, address(this), _amount);
            totalReward = totalReward.add(_amount);
        } else {
            bonusToken.safeTransferFrom(msg.sender, address(this), _amount);
            totalBonusReward = totalBonusReward.add(_amount);
        }

        emit Donate(msg.sender, _amount, _token);
  }

  /**********************
   * private Functions *
   **********************/

   /**
   * @dev calculate reward from shares
   * @param _share number of shares
   * @param _tokenTotalReward total token amount for which to calculate a reward (either base or bonus token reward)
   */
    function _rewardFromShares(uint256 _share, uint256 _tokenTotalReward) internal view returns (uint256) {
    uint256 cachedPrecisionFactor = PRECISION_FACTOR;

        if (_tokenTotalReward > 0) {
            uint256 payout =
                _tokenTotalReward
                    .mul(cachedPrecisionFactor)
                    .mul(_share)
                    .div(totalShares)
                    .div(cachedPrecisionFactor);
            return payout;
        } else {
            return 0;
        }
  }

  /**
   * @dev quit the pool before expiry. 
   * calling this function will automatically redeem some of user's outstanding shares, 
   * proportional to the amount they're withdrawing early.
   * This is to prevent a user leaving a pool and keep earning rewards
   * @param _amount amount to withdraw before penalty
   */
  function _quit(uint256 _amount) private {
    require(block.timestamp < expiry, "EXPIRED");
        
    // force redeem if user has outstanding shares.
    // Need to perform before _quit, so a user won't get reward from his own exit.
    if (_shares[msg.sender] > 0) {
      uint256 sharesToRedeem = _calculateSharesForceRedeem(msg.sender, _amount);
      _redeem(sharesToRedeem);
    }

    _penalizeAndExit(_amount);
  }

  /**
   * @dev calculate the payout / reward / fee, and distribute funds
   * @param _amount withdraw amount
   */
  function _penalizeAndExit(uint256 _amount) private {
    // this will revert if user is trying to call exit with amount more than his holdings.
    _burn(msg.sender, _amount);

    (uint256 payout, uint256 reward, uint256 fee) = _calculateExitPayout(_amount);(_amount);
    
    // increase total in reward pool
    totalReward = totalReward.add(reward);

    emit Exit(msg.sender, payout, reward, fee);

    if (payout > 0) token.safeTransfer(msg.sender, payout);
    if (fee > 0) token.safeTransfer(feeRecipient, fee);
  }

  /**
   * @dev withdraw post expiry
   * @param _amount withdraw amount
   */
  function _withdraw(uint256 _amount) private {
    require(block.timestamp >= expiry, "!EXPIRED");
    
    _burn(msg.sender, _amount);

    emit Withdraw(msg.sender, _amount);

    token.safeTransfer(msg.sender, _amount);  
  }

  /**
   * @dev reduce user share and send reward based on current reward pool.
   * @param _share amount of share
   */
  function _redeem(uint256 _share) private {
    uint256 baseTokenPayout = _rewardFromShares(_share, totalReward);
    uint256 bonusTokenPayout = _rewardFromShares(_share, totalBonusReward);
    // reduce total price recorded
    totalReward = totalReward.sub(baseTokenPayout);
    totalBonusReward = totalBonusReward.sub(bonusTokenPayout);
    totalShares = totalShares.sub(_share);

    // subtract shares from user shares. this will revert if user doesn't have sufficient shares
    _shares[msg.sender] = _shares[msg.sender].sub(_share);

    emit Redeem(msg.sender, _share, baseTokenPayout, bonusTokenPayout);

    if (baseTokenPayout > 0)
        token.safeTransfer(msg.sender, baseTokenPayout);
    if (bonusTokenPayout > 0)
        bonusToken.safeTransfer(msg.sender, bonusTokenPayout);
  }

  /**
   * calculate amount of shares the user is forced to redeem when quitting early
   * @param _account account requesting
   * @param _amount amount of token quitting
   */
    function _calculateSharesForceRedeem(address _account, uint256 _amount) internal view returns (uint256) {
        uint256 totalCapital = balanceOf(_account);
        uint256 accountShares = _shares[_account];
        uint256 cachedPrecisionFactor = PRECISION_FACTOR;
        
        return _amount
        .mul(accountShares)
        .mul(cachedPrecisionFactor)
        .div(totalCapital)
        .div(cachedPrecisionFactor);
  }

   /**
   * @dev calculate how much of _amount can be taken out by user / goes to reward pool / goes to feeRecipient
   * @param _amount total amount requested to withdraw before expiry.
   */
   function _calculateExitPayout(uint256 _amount) internal view returns (uint256 payout, uint256 reward, uint256 fee) {
    uint256 cachedBase = BASE; // save SLOAD
    uint256 totalPenalty = _amount.mul(penaltyPortion).div(cachedBase);
    
    fee = totalPenalty.mul(feePortion).div(cachedBase);
    reward = totalPenalty.sub(fee);
    payout = _amount.sub(totalPenalty);
  }

  /**
   * @dev the share you get depositing _amount into the pool. Dependent on n.
   *      eg. when n = 1, the shares decrease linear as time goes by;
   *          when n = 2, the shares decrease exponentially.
   * 
   *                        (timeLeft)^ n
   * share = amount * --------------------------
   *                      (total duration)^ n
   */
  function _calculateShares(uint256 _amount) internal view returns (uint256) {
    uint256 timeLeft = expiry - block.timestamp;
    uint256 cachedPrecisionFactor = PRECISION_FACTOR;
    return _amount.mul(timeLeft**n)
      .mul(cachedPrecisionFactor)
      .div(totalTime**n)
      .div(cachedPrecisionFactor);
  }

  /**
   * hook to prevent transferring the hodlToken
   */
    function _beforeTokenTransfer(address from, address to, uint256) internal override {
    require(from == address(0) || to == address(0), "!TRANSFER");
  }
}
