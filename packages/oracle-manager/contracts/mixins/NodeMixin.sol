//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/NodeFactoryStorage.sol";

contract NodeMixin is NodeFactoryStorage {
    function getNode(bytes32 nodeId) external view returns (NodeDefenition memory nodeDefinition) {
        nodeDefinition = _nodeFactoryStore().nodes[nodeId];
    }
}
