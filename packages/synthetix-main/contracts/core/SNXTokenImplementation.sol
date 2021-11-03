//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/proxy/OwnableUUPSImplementation.sol";

contract SNXTokenImplementation is OwnableUUPSImplementation, ERC20 {
    // solhint-disable no-empty-blocks
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) ERC20(name, symbol, decimals) {}
}
