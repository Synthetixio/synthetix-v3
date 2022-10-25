//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Permission.sol";

library FeatureFlag {
    struct Data {
        mapping(bytes32 => Permission.Data) featureFlags;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("FeatureFlag"));
        assembly {
            // bytes32(uint(keccak256("io.synthetix.featureFlag")) - 1)
            store.slot := s
        }
    }
}
