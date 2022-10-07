//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";

contract SynthMixin is ERC20 {
    error InsufficientFunds();
}
