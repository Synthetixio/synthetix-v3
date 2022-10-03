//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NodeFactoryStorage {
    enum NodeType {
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

    struct NodeFactoryStore {
        mapping(bytes32 => NodeDefinition) nodes;
    }

    struct NodeData {
        int price;
        uint timestamp;
        uint volatilityScore;
        uint liquidityScore;
    }

    function _nodeFactoryStore() internal pure returns (NodeFactoryStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.oracle-manager.node-factory")) - 1)
            store.slot := 0xa01cbbc58636cff8e850ea840c97c0df1a3bc90537758f50c9feb4d82dc4aa69
        }
    }
}
