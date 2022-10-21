//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/OracleManagerStorage.sol";

contract NodeMixin is OracleManagerStorage {
    function _getNode(bytes32 nodeId) internal view returns (NodeDefinition memory nodeDefinition) {
        nodeDefinition = _oracleManagerStore().nodes[nodeId];
    }

    modifier onlyValidNodeType(NodeType nodeType) {
        if (!_validateNodeType(nodeType)) {
            revert("Unsupported Node Type");
        }

        _;
    }

    function _validateNodeType(NodeType nodeType) internal pure returns (bool) {
        if (
            NodeType.REDUCER == nodeType ||
            NodeType.EXTERNAL == nodeType ||
            NodeType.CHAINLINK == nodeType ||
            NodeType.PYTH == nodeType
        ) return true;

        return false;
    }
}
