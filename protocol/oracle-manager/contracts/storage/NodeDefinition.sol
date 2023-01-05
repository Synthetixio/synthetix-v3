//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library NodeDefinition {
    enum NodeType {
        NONE,
        REDUCER,
        EXTERNAL,
        CHAINLINK,
        UNISWAP,
        PYTH,
        PRICE_DEVIATION_CIRCUIT_BREAKER,
        STALENESS_CIRCUIT_BREAKER
    }

    struct Data {
        NodeType nodeType;
        bytes parameters;
        bytes32[] parents;
    }

    function load(bytes32 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("io.synthetix.oracle-manager.Node", id));
        assembly {
            data.slot := s
        }
    }

    function create(
        Data memory nodeDefinition
    ) internal returns (NodeDefinition.Data storage self, bytes32 id) {
        id = getId(nodeDefinition);

        self = load(id);

        self.nodeType = nodeDefinition.nodeType;
        self.parameters = nodeDefinition.parameters;
        self.parents = nodeDefinition.parents;
    }

    function getId(Data memory nodeDefinition) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    nodeDefinition.nodeType,
                    nodeDefinition.parameters,
                    nodeDefinition.parents,
                )
            );
    }
}
