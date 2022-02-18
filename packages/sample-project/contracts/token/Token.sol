//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";

contract Token is ERC20 {
    constructor() {
        _initialize("Token", "STS", 0);
    }
}
