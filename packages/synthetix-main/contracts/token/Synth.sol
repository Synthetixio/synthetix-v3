//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "../interfaces/ISynth.sol";

contract Synth is ERC20, ISynth {
    function initialize(
        string memory synthName,
        string memory synthSymbol,
        uint8 synthDecimals
    ) external override {
        _initialize(synthName, synthSymbol, synthDecimals);
    }
}
