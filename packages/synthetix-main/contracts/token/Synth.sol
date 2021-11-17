//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";

contract Synth is ERC20 {
    function initialize(
        string memory synthName,
        string memory synthSymbol,
        uint8 synthDecimals
    ) external {
        _initialize(synthName, synthSymbol, synthDecimals);
    }
}
