//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NodeDefinition.sol";

library Node {
    using NodeDefinition for NodeDefinition.Data;

    struct Data {
        mapping(bytes32 => NodeDefinition.Data) nodes;
    }

    function load() internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("Node"));
        assembly {
            data.slot := s
        }
    }
}
