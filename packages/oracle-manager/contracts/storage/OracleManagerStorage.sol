//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OracleManagerStorage {
    enum NodeType {
        NONE,
        REDUCER,
        EXTERNAL,
        CHAINLINK,
        PYTH
    }

    struct NodeDefinition {
        bytes32[] parents;
        NodeType nodeType;
        bytes parameters;
    }

    struct NodeData {
        int256 price;
        uint timestamp;
        uint volatilityScore;
        uint liquidityScore;
    }

    struct OracleManagerStore {
        mapping(bytes32 => NodeDefinition) nodes;
    }

    function _oracleManagerStore() internal pure returns (OracleManagerStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.oracle-manager")) - 1)
            store.slot := 0x848eab3a45181312a8b5fdc5bfab6bd2a6a28084d5e879671607667f6a0cfe15
        }
    }
}
