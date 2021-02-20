//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

// import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20PermitUpgradeable} from "@openzeppelin/contracts-upgradeable/drafts/ERC20PermitUpgradeable.sol";
import {IERC20WithDecimals} from "./interfaces/IERC20WithDecimals.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

contract Hodl is ERC20PermitUpgradeable {
  using SafeERC20 for IERC20WithDecimals;
  using SafeMath for uint256;

  IERC20WithDecimals public token;
  uint256 public penalty;
  uint256 public end;

  uint256 constant PENALTY_BASE = 1000;

  /**
   * @param _token address of the token of this hold contract
   * @param _penalty amount
   * @param _end timestamp in sec, after which the locking is over.
   * @param _name name of the token
   * @param _symbol symbol of the new token
   */
  function init(address _token, uint256 _penalty, uint256 _end, string memory _name, string memory _symbol) external {
    require(penalty < PENALTY_BASE, "INVALID_PENALTY");
    require(block.timestamp < _end, "INVALID_END");
    
    token = IERC20WithDecimals(_token);
    penalty = _penalty;
    end = _end;

    uint8 decimals = token.decimals();

    __ERC20_init(_name, _symbol);
    _setupDecimals(decimals);
  }

  /**
   * @param _amount amount of token to transfer into the Hodl contract
   */
  function deposit(uint256 _amount) external {
    token.safeTransferFrom(msg.sender, address(this), _amount);
    _mint(msg.sender, _amount);
  }
  
  /**
   * @dev redeem token from the contract.
   * before endTime: get out _share * discount / 100
   * after endTime: get out tokenBalance / 
   */
  function exit(uint256 _share) external {
    uint256 amount;
    if (block.timestamp < end) {
      amount = _share.mul(PENALTY_BASE.sub(penalty)).div(PENALTY_BASE);
    } else {  
      uint256 tokenBalance = token.balanceOf(address(this));
      amount = _share.mul(tokenBalance).div(totalSupply());
    }
    token.safeTransfer(msg.sender, amount);
    _burn(msg.sender, _share);
  }
}
