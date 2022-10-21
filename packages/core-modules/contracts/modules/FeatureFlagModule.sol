//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../mixins/FeatureFlagMixin.sol";
import "../storage/FeatureFlagStorage.sol";
import "../interfaces/IFeatureFlag.sol";

contract FeatureFlagModule is IFeatureFlag, FeatureFlagMixin, OwnableMixin {
    using SetUtil for SetUtil.AddressSet;

    function setFeatureFlag(bytes32 feature, bool value) external override onlyOwner {
        _featureFlagStore().featureFlags[feature].enabled = value;
    }

    function addToFeatureFlag(bytes32 feature, address permissioned) external override onlyOwner {
        _featureFlagStore().featureFlags[feature].permissionedAddresses.add(permissioned);
    }

    function removeFromFeatureFlag(bytes32 feature, address permissioned) external override onlyOwner {
        _featureFlagStore().featureFlags[feature].permissionedAddresses.remove(permissioned);
    }
}
