//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/NodeFactoryStorage.sol";

/// @title Module for managing nodes
interface INodeFactoryModule {
    function registerNode(
        bytes32[] memory parents,
        NodeFactoryStorage.NodeType nodeType,
        bytes memory parameters
    ) external returns (bytes32);

    function getNodeId(
        bytes32[] memory parents,
        NodeFactoryStorage.NodeType nodeType,
        bytes memory parameters
    ) external returns (bytes32);

    function getNode(bytes32 nodeId) external view returns (NodeFactoryStorage.NodeDefinition memory);

    function process(bytes32 nodeId) external view returns (NodeFactoryStorage.NodeData memory);
}
