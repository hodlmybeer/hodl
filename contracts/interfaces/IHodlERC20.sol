//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

interface IHodlERC20 {
  function init(
    address _token, 
    uint256 _penalty, 
    uint256 _lockWindow, 
    uint256 _expiry, 
    address _feeRecipient, 
    string memory _name, 
    string memory _symbol
  ) external;
}
