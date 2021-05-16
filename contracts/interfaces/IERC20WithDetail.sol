//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20WithDetail is IERC20 {
  function name() view external returns (string memory);
  function symbol() view external returns (string memory);
  function decimals() view external returns (uint8);
}
