//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/NodeFactoryStorage.sol";
import "../../interfaces/INodeFactoryModule.sol";
import "../../utils/ReducerNodeLibrary.sol";
import "../../utils/ExternalNodeLibrary.sol";

contract NodeFactoryModule is INodeFactoryModule, NodeFactoryStorage {
    function registerNode(NodeDefenition memory nodeDefinition) external returns (bytes32 nodeId) {
        //check and make sure all nodeDefinition.parents are already registered
        nodeId = _getNodeId(nodeDefinition);
        _nodeFactoryStore().nodes[nodeId] = nodeDefinition;
    }

    function proccess(bytes32 nodeId) external view returns (NodeData memory price) {
        NodeDefenition memory nodeDefinition = _nodeFactoryStore().nodes[nodeId];

        NodeData[] memory prices = new NodeData[](nodeDefinition.parents.length);
        for (uint256 i = 0; i < nodeDefinition.parents.length; i++) {
            prices[i] = this.proccess(nodeDefinition.parents[i]);
        }

        if (nodeDefinition.nodeType == NodeType.REDUCER) {
            // call reducer node library
            return ReducerNodeLibrary.proccess(prices, nodeDefinition.parameters);
        } else if (nodeDefinition.nodeType == NodeType.EXTERNAL) {
            // call external node library
            return ExternalNodeLibrary.proccess(prices, nodeDefinition.parameters);
        } else {
            revert("Unsupported Node Type");
        }
    }

    function _getNodeId(NodeDefenition memory nodeDefinition) internal pure returns (bytes32 nodeId) {
        nodeId = keccak256(abi.encode(nodeDefinition.parents, nodeDefinition.nodeType, nodeDefinition.parameters));
    }
}
