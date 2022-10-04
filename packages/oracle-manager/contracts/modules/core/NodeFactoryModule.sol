//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/INodeFactoryModule.sol";
import "../../utils/ReducerNodeLibrary.sol";
import "../../utils/ExternalNodeLibrary.sol";
// import "../../utils/ChainlinkNodeLibrary.sol";
import "../../utils/PythNodeLibrary.sol";
import "../../mixins/NodeMixin.sol";

contract NodeFactoryModule is INodeFactoryModule, NodeMixin {
    function registerNode(NodeDefinition memory nodeDefinition) external returns (bytes32) {
        return _registerNode(nodeDefinition);
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
            // call reducer node library
            return ReducerNodeLibrary.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeType.EXTERNAL) {
            // call external node library
            return ExternalNodeLibrary.process(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeType.CHAINLINK) {
            // return ChainlinkNodeLibrary.process(nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeType.PYTH) {
            return PythNodeLibrary.process(nodeDefinition.parameters);
        } else {
            revert("Unsupported Node Type");
        }
    }
}
