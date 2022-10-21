//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract FeatureFlagStorage {
    struct FeatureFlagStore {
        mapping(bytes32 => Permission) featureFlags;
    }

    struct Permission {
        bool enabled;
        SetUtil.AddressSet permissionedAddresses;
    }

    function _featureFlagStore() internal pure returns (FeatureFlagStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.featureFlag")) - 1)
            store.slot := 0x844359724a93fe2b6e37302d95a100b7d3a8085932a4ac9a61c4e361ac3ea318
        }
    }
}
