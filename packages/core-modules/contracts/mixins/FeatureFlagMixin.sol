//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "../storage/FeatureFlagStorage.sol";

contract FeatureFlagMixin is FeatureFlagStorage {
    using SetUtil for SetUtil.AddressSet;

    error FeatureUnavailable();

    modifier onlyIfFeatureFlag(bytes32 feature) {
        FeatureFlagStore storage store = _featureFlagStore();

        if (!store.featureFlags[feature].enabled) {
            revert FeatureUnavailable();
        }

        if (!store.featureFlags[feature].permissionedAddresses.contains(msg.sender)) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _;
    }
}
