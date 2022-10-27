//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

library FeatureFlag {
    using SetUtil for SetUtil.AddressSet;

    struct Data {
        bytes32 name;
        bool enabled;
        SetUtil.AddressSet permissionedAddresses;
    }

    function load(bytes32 featureName) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("FeatureFlag", featureName));
        assembly {
            store.slot := s
        }
    }

    function ensureEnabled(bytes32 feature) internal view {
        Data storage store = FeatureFlag.load(feature);

        if (store.enabled && !store.permissionedAddresses.contains(msg.sender)) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }
}
