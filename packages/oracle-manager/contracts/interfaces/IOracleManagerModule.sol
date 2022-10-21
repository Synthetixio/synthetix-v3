//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/OracleManagerStorage.sol";

/// @title Module for managing nodes
interface IOracleManagerModule {
    function registerNode(
        bytes32[] memory parents,
        OracleManagerStorage.NodeType nodeType,
        bytes memory parameters
    ) external returns (bytes32);

    function getNodeId(
        bytes32[] memory parents,
        OracleManagerStorage.NodeType nodeType,
        bytes memory parameters
    ) external returns (bytes32);

    function getNode(bytes32 nodeId) external view returns (OracleManagerStorage.NodeDefinition memory);

    function process(bytes32 nodeId) external returns (OracleManagerStorage.NodeData memory);
}
