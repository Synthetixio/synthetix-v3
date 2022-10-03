//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/NodeFactoryStorage.sol";

/// @title Module for managing nodes
interface INodeFactoryModule {
    function registerNode(NodeFactoryStorage.NodeDefinition memory nodeDefinition) external returns (bytes32 nodeId);

    function process(bytes32 nodeId) external view returns (NodeFactoryStorage.NodeData memory price);
}
