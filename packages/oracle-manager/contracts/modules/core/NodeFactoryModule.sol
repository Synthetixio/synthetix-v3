//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/INodeFactoryModule.sol";
import "../../utils/ReducerNodeLibrary.sol";
import "../../utils/ExternalNodeLibrary.sol";
import "../../utils/PythNodeLibrary.sol";
import "../../utils/ChainlinkNodeLIbrary.sol";
import "../../mixins/NodeMixin.sol";

contract NodeFactoryModule is INodeFactoryModule, NodeMixin {
    function registerNode(
        bytes32[] memory parents,
        NodeType nodeType,
        bytes memory parameters
    ) external returns (bytes32) {
        NodeDefinition memory nodeDefinition = NodeDefinition({
            parents: parents,
            nodeType: nodeType,
            parameters: parameters
        });

        return _registerNode(nodeDefinition);
    }

    function getNodeId(
        bytes32[] memory parents,
        NodeType nodeType,
        bytes memory parameters
    ) external view returns (bytes32) {
        NodeDefinition memory nodeDefinition = NodeDefinition({
            parents: parents,
            nodeType: nodeType,
            parameters: parameters
        });

        return _getNodeId(nodeDefinition);
    }

    function getNode(bytes32 nodeId) external view returns (NodeDefinition memory) {
        return _getNode(nodeId);
    }

    function process(bytes32 nodeId) external view returns (NodeData memory) {
        return _process(nodeId);
    }

    function _getNodeId(NodeDefinition memory nodeDefinition) internal pure returns (bytes32 nodeId) {
        nodeId = keccak256(abi.encode(nodeDefinition.parents, nodeDefinition.nodeType, nodeDefinition.parameters));
    }

    function _registerNode(NodeDefinition memory nodeDefinition)
        internal
        onlyValidNodeType(nodeDefinition.nodeType)
        returns (bytes32 nodeId)
    {
        //check and make sure all nodeDefinition.parents are already registered
        for (uint256 i = 0; i < nodeDefinition.parents.length; i++) {
            if (!_nodeIsRegistered(nodeDefinition.parents[i])) {
                revert("Parent not registered");
            }
        }

        nodeId = _getNodeId(nodeDefinition);
        _nodeFactoryStore().nodes[nodeId] = nodeDefinition;
    }

    function _nodeIsRegistered(bytes32 nodeId) internal view returns (bool) {
        NodeDefinition memory nodeDefinition = _nodeFactoryStore().nodes[nodeId];
        return (nodeDefinition.nodeType != NodeType.NONE);
    }

    function _process(bytes32 nodeId) internal view returns (NodeData memory price) {
        NodeDefinition memory nodeDefinition = _nodeFactoryStore().nodes[nodeId];

        NodeData[] memory prices = new NodeData[](nodeDefinition.parents.length);
        for (uint256 i = 0; i < nodeDefinition.parents.length; i++) {
            prices[i] = this.process(nodeDefinition.parents[i]);
        }

        if (nodeDefinition.nodeType == NodeType.REDUCER) {
            return ReducerNodeLibrary.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeType.EXTERNAL) {
            return ExternalNodeLibrary.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeType.CHAINLINK) {
            return ChainlinkNodeLibrary.process(nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeType.PYTH) {
            return PythNodeLibrary.process(nodeDefinition.parameters);
        } else {
            revert("Unsupported Node Type");
        }
    }
}
