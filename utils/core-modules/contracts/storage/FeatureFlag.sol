//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

library FeatureFlag {
    using SetUtil for SetUtil.AddressSet;

    error FeatureUnavailable();

    struct Data {
        bytes32 name;
        bool allowAll;
        SetUtil.AddressSet permissionedAddresses;
    }

    function load(bytes32 featureName) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.core-modules.FeatureFlag", featureName));
        assembly {
            store.slot := s
        }
    }

    function ensureAccessToFeature(bytes32 feature) internal view {
        if (!hasAccess(feature, msg.sender)) {
            revert FeatureUnavailable();
        }
    }

    function hasAccess(bytes32 feature, address value) internal view returns (bool) {
        Data storage store = FeatureFlag.load(feature);

        return store.allowAll || store.permissionedAddresses.contains(value);
    }
}
