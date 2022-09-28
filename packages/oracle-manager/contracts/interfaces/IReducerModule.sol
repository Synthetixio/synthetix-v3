//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/ReducerStorage.sol";

/// @title Module for reducing price in vaults
interface IReducerModule {
    function getPrice() external returns (ReducerStorage.NodeData memory price);
}
