//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISynth {
    function initialize(
        string memory synthName,
        string memory synthSymbol,
        uint8 synthDecimals
    ) external;
}
