//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "./Permission.sol";

library FeatureFlag {
    using SetUtil for SetUtil.AddressSet;

    error FeatureUnavailable();

    struct Data {
        mapping(bytes32 => Permission.Data) featureFlags;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("FeatureFlag"));
        assembly {
            store.slot := s
        }
    }

    function onlyIfFeatureFlag(bytes32 feature) internal view {
        Data storage store = FeatureFlag.load();

        if (!store.featureFlags[feature].enabled) {
            revert FeatureUnavailable();
        }

        if (!store.featureFlags[feature].permissionedAddresses.contains(msg.sender)) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }
}
