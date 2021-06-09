//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

interface IHodlERC20 {
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
  ) external;
}
