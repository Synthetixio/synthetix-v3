//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/NodeOutput.sol";
import "../storage/NodeDefinition.sol";

/// @title Module for managing nodes
interface INodeModule {
    /**
     * @notice Thrown when the specified nodeId has not been registered in the system.
     */
    error NodeNotRegistered(bytes32 nodeId);

    /**
     * @notice Thrown when a node is registered without a valid definition.
     */
    error InvalidNodeDefinition(NodeDefinition.Data nodeType);

    /**
     * @notice An array of revert reasons when an array of nodes is processed, but some of the nodes failed
     */
    error Errors(bytes[] revertReasons);

    /**
     * @notice ERC-7412 OracleDataRequired error definition. While not explicitly reverted by NodeModule, its a commonly encountered error that makes it useful to have it declared here
     */
    error OracleDataRequired(address oracleContract, bytes oracleQuery);

    /**
     * @notice Emitted when `registerNode` is called.
     * @param nodeId The id of the registered node.
     * @param nodeType The nodeType assigned to this node.
     * @param parameters The parameters assigned to this node.
     * @param parents The parents assigned to this node.
     */
    event NodeRegistered(
        bytes32 nodeId,
        NodeDefinition.NodeType nodeType,
        bytes parameters,
        bytes32[] parents
    );

    /**
     * @notice Registers a node
     * @param nodeType The nodeType assigned to this node.
     * @param parameters The parameters assigned to this node.
     * @param parents The parents assigned to this node.
     * @return nodeId The id of the registered node.
     */
    function registerNode(
        NodeDefinition.NodeType nodeType,
        bytes memory parameters,
        bytes32[] memory parents
    ) external returns (bytes32 nodeId);

    /**
     * @notice Returns the ID of a node, whether or not it has been registered.
     * @param parents The parents assigned to this node.
     * @param nodeType The nodeType assigned to this node.
     * @param parameters The parameters assigned to this node.
     * @return nodeId The id of the node.
     */
    function getNodeId(
        NodeDefinition.NodeType nodeType,
        bytes memory parameters,
        bytes32[] memory parents
    ) external pure returns (bytes32 nodeId);

    /**
     * @notice Returns a node's definition (type, parameters, and parents)
     * @param nodeId The node ID
     * @return node The node's definition data
     */
    function getNode(bytes32 nodeId) external pure returns (NodeDefinition.Data memory node);

    /**
     * @notice Returns a node current output data
     * @param nodeId The node ID
     * @return node The node's output data
     */
    function process(bytes32 nodeId) external view returns (NodeOutput.Data memory node);

    /**
     * @notice Returns a node current output data
     * @param nodeId The node ID
     * @param runtimeKeys Keys corresponding to runtime values which could be used by the node graph
     * @param runtimeValues The values used by the node graph
     * @return node The node's output data
     */
    function processWithRuntime(
        bytes32 nodeId,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view returns (NodeOutput.Data memory node);

    /**
     * @notice Returns node current output data for many nodes at the same time, aggregating errors (if any)
     * @param nodeIds The node ID
     * @param runtimeKeys Keys corresponding to runtime values which could be used by the node graph. The same keys are used for all nodes
     * @param runtimeValues The values used by the node graph. The same values are used for all nodes
     * @return nodes The output data for all the nodes
     */
    function processManyWithRuntime(
        bytes32[] memory nodeIds,
        bytes32[] memory runtimeKeys,
        bytes32[] memory runtimeValues
    ) external view returns (NodeOutput.Data[] memory nodes);

    /**
     * @notice Same as `processManyWithRuntime`, but allows for different runtime for each oracle call.
     * @param nodeIds The node ID
     * @param runtimeKeys Keys corresponding to runtime values which could be used by the node graph.
     * @param runtimeValues The values used by the node graph.
     * @return nodes The output data for all the nodes
     */
    function processManyWithManyRuntime(
        bytes32[] memory nodeIds,
        bytes32[][] memory runtimeKeys,
        bytes32[][] memory runtimeValues
    ) external view returns (NodeOutput.Data[] memory nodes);
}
