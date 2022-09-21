//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

/// @title Spot Market Synth Interface
interface ISynth {
    function mint(address to, uint amount) external;

    function burn(address from, uint amount) external;
}
