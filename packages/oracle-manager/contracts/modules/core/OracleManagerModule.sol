//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IOracleManagerModule.sol";
import "../../utils/ReducerNodeLibrary.sol";
import "../../utils/ExternalNodeLibrary.sol";
import "../../utils/PythNodeLibrary.sol";
import "../../utils/ChainlinkNodeLibrary.sol";

import "../../storage/Node.sol";
import "../../storage/NodeData.sol";
import "../../storage/NodeDefinition.sol";

contract OracleManagerModule is IOracleManagerModule {
    error UnsupportedNodeType(uint nodeType);
    error NodeNotRegistered(bytes32 nodeId);

    function registerNode(
        bytes32[] memory parents,
        NodeDefinition.NodeType nodeType,
        bytes memory parameters
    ) external returns (bytes32) {
        NodeDefinition.Data memory nodeDefinition = NodeDefinition.Data({
            parents: parents,
            nodeType: nodeType,
            parameters: parameters
        });

        return _registerNode(nodeDefinition);
    }

    function getNodeId(
        bytes32[] memory parents,
        NodeDefinition.NodeType nodeType,
        bytes memory parameters
    ) external pure returns (bytes32) {
        NodeDefinition.Data memory nodeDefinition = NodeDefinition.Data({
            parents: parents,
            nodeType: nodeType,
            parameters: parameters
        });

        return _getNodeId(nodeDefinition);
    }

    function getNode(bytes32 nodeId) external view returns (NodeDefinition.Data memory) {
        return _getNode(nodeId);
    }

    function process(bytes32 nodeId) external view returns (NodeData.Data memory) {
        return _process(nodeId);
    }

    function _getNode(bytes32 nodeId) internal view returns (NodeDefinition.Data memory nodeDefinition) {
        nodeDefinition = Node.load().nodes[nodeId];
    }

    modifier onlyValidNodeType(NodeDefinition.NodeType nodeType) {
        if (!_validateNodeType(nodeType)) {
            revert UnsupportedNodeType(uint(nodeType));
        }

        _;
    }

    function _validateNodeType(NodeDefinition.NodeType nodeType) internal pure returns (bool) {
        if (
            NodeDefinition.NodeType.REDUCER == nodeType ||
            NodeDefinition.NodeType.EXTERNAL == nodeType ||
            NodeDefinition.NodeType.CHAINLINK == nodeType ||
            NodeDefinition.NodeType.PYTH == nodeType
        ) return true;

        return false;
    }

    function _getNodeId(NodeDefinition.Data memory nodeDefinition) internal pure returns (bytes32 nodeId) {
        nodeId = keccak256(abi.encode(nodeDefinition.parents, nodeDefinition.nodeType, nodeDefinition.parameters));
    }

    function _registerNode(NodeDefinition.Data memory nodeDefinition)
        internal
        onlyValidNodeType(nodeDefinition.nodeType)
        returns (bytes32 nodeId)
    {
        // checks nodeDefinition.parents if they are valid
        for (uint256 i = 0; i < nodeDefinition.parents.length; i++) {
            if (!_nodeIsRegistered(nodeDefinition.parents[i])) {
                revert NodeNotRegistered(nodeDefinition.parents[i]);
            }
        }

        nodeId = _getNodeId(nodeDefinition);
        Node.load().nodes[nodeId] = nodeDefinition;
    }

    function _nodeIsRegistered(bytes32 nodeId) internal view returns (bool) {
        NodeDefinition.Data memory nodeDefinition = Node.load().nodes[nodeId];
        return (nodeDefinition.nodeType != NodeDefinition.NodeType.NONE);
    }

    function _process(bytes32 nodeId) internal view returns (NodeData.Data memory price) {
        NodeDefinition.Data memory nodeDefinition = Node.load().nodes[nodeId];

        NodeData.Data[] memory prices = new NodeData.Data[](nodeDefinition.parents.length);
        for (uint256 i = 0; i < nodeDefinition.parents.length; i++) {
            prices[i] = this.process(nodeDefinition.parents[i]);
        }

        if (nodeDefinition.nodeType == NodeDefinition.NodeType.REDUCER) {
            return ReducerNodeLibrary.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.EXTERNAL) {
            return ExternalNodeLibrary.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.CHAINLINK) {
            return ChainlinkNodeLibrary.process(nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeDefinition.NodeType.PYTH) {
            return PythNodeLibrary.process(nodeDefinition.parameters);
        } else {
            revert UnsupportedNodeType(uint(nodeDefinition.nodeType));
        }
    }
}
