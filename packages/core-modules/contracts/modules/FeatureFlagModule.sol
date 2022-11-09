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

    function setFeatureFlagAllowAll(bytes32 feature, bool allowAll) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load(feature).allowAll = allowAll;

        emit FeatureFlagSet(feature, allowAll);
    }

    function addToFeatureFlagAllowlist(bytes32 feature, address permissioned) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load(feature).permissionedAddresses.add(permissioned);

        emit FeatureFlagAddressAdded(feature, permissioned);
    }

    function removeFromFreatureFlagAllowlist(bytes32 feature, address permissioned) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load(feature).permissionedAddresses.remove(permissioned);

        emit FeatureFlagAddressRemoved(feature, permissioned);
    }

    function getFeatureFlagAllowAll(bytes32 feature) external view override returns (bool) {
        return FeatureFlag.load(feature).allowAll;
    }

    function getFeatureFlagAllowlist(bytes32 feature) external view override returns (address[] memory) {
        return FeatureFlag.load(feature).permissionedAddresses.values();
    }

    function isFeatureAllowed(bytes32 feature, address addressToCheck) external view override returns (bool) {
        return FeatureFlag.hasAccess(feature, addressToCheck);
    }
}
