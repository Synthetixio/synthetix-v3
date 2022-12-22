//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/Node.sol";
import "../storage/NodeDefinition.sol";

/// @title Module for managing nodes
interface IOracleManagerModule {
    error NodeNotRegistered(bytes32 nodeId);

    function registerNode(
        bytes32[] memory parents,
        NodeDefinition.NodeType nodeType,
        bytes memory parameters
    ) external returns (bytes32);

    function getNodeId(
        bytes32[] memory parents,
        NodeDefinition.NodeType nodeType,
        bytes memory parameters
    ) external returns (bytes32);

    function getNode(bytes32 nodeId) external view returns (NodeDefinition.Data memory);

    function process(bytes32 nodeId) external view returns (Node.Data memory);
}
