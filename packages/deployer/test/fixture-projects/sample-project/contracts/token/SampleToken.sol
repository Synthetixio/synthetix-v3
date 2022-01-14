//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";

contract SampleToken is ERC20 {
    constructor() {
        _initialize("SampleToken", "STS", 0);
    }
}
