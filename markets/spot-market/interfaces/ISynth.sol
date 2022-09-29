//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Spot Market Synth Interface
interface ISynth {
    function mint(address to, uint amount) external;

    function burn(address from, uint amount) external;
}
