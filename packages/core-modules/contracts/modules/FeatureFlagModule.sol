//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "../storage/FeatureFlag.sol";

import "../interfaces/IFeatureFlagModule.sol";

contract FeatureFlagModule is IFeatureFlagModule {
    using SetUtil for SetUtil.AddressSet;

    event FeatureFlagSet(bytes32 feature, bool value);
    event FeatureFlagAddressAdded(bytes32 feature, address account);
    event FeatureFlagAddressRemoved(bytes32 feature, address account);

    function setFeatureFlag(bytes32 feature, bool value) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load(feature).enabled = value;

        emit FeatureFlagSet(feature, value);
    }

    function addToFeatureFlag(bytes32 feature, address permissioned) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load(feature).permissionedAddresses.add(permissioned);

        emit FeatureFlagAddressAdded(feature, permissioned);
    }

    function removeFromFeatureFlag(bytes32 feature, address permissioned) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load(feature).permissionedAddresses.remove(permissioned);

        emit FeatureFlagAddressRemoved(feature, permissioned);
    }

    function isFeatureFlagEnabled(bytes32 feature) external view override returns (bool) {
        return FeatureFlag.load(feature).enabled;
    }

    function getFeatureFlagAddresses(bytes32 feature) external view override returns (address[] memory) {
        return FeatureFlag.load(feature).permissionedAddresses.values();
    }
}
