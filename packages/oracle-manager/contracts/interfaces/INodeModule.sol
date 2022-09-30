//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/NodeFactoryStorage.sol";

/// @title Module for reducing price in vaults
interface INodeModule {
    function getPrice() external returns (NodeFactoryStorage.NodeData memory price);
}
