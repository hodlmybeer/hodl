//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20WithDecimals is IERC20 {

  function decimals() external returns (uint8);

}
