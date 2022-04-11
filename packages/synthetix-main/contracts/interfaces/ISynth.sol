//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IAuthorizable.sol";

interface ISynth is IAuthorizable {
    function initialize(
        string memory synthName,
        string memory synthSymbol,
        uint8 synthDecimals
    ) external;
}
