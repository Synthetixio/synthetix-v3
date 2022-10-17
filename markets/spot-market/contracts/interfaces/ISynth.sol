//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Synth interface
interface ISynth {
    function mint(address to, uint256 amount) external;

    function burn(address from, uint256 amount) external;

    function setAllowance(
        address from,
        address spender,
        uint amount
    ) external;
}
