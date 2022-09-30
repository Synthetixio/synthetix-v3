//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NodeFactoryStorage {
    enum NodeType {
        REDUCER,
        EXTERNAL,
        CHAINLINK,
        UNISWAP
    }

    struct NodeDefenition {
        bytes32[] parents;
        NodeType nodeType;
        bytes parameters;
    }

    struct NodeFactoryStore {
        mapping(bytes32 => NodeDefenition) nodes;
    }

    struct NodeData {
        uint price;
        uint timestamp;
        uint volatilityScore;
        uint liquidityScore;
    }

    function _nodeFactoryStore() internal pure returns (NodeFactoryStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.accountmodule")) - 1)
            store.slot := 0xa02d1156ddedf1a9cbc88cd7ce7868a5600323fb301d1e51e70fd83a1b670815
        }
    }
}
