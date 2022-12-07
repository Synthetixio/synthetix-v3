//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "../storage/FeatureFlag.sol";

import "../interfaces/IFeatureFlagModule.sol";

/**
 * @title Module for granular enabling and disabling of system features and functions.
 * See IFeatureFlagModule.
 */
contract FeatureFlagModule is IFeatureFlagModule {
    using SetUtil for SetUtil.AddressSet;

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function setFeatureFlagAllowAll(bytes32 feature, bool allowAll) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load(feature).allowAll = allowAll;

        emit FeatureFlagAllowAllSet(feature, allowAll);
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function addToFeatureFlagAllowList(bytes32 feature, address account) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load(feature).permissionedAddresses.add(account);

        emit FeatureFlagAllowListAdded(feature, account);
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function removeFromFeatureFlagAllowList(bytes32 feature, address account) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load(feature).permissionedAddresses.remove(account);

        emit FeatureFlagAllowListRemoved(feature, account);
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function getFeatureFlagAllowAll(bytes32 feature) external view override returns (bool) {
        return FeatureFlag.load(feature).allowAll;
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function getFeatureFlagAllowList(
        bytes32 feature
    ) external view override returns (address[] memory) {
        return FeatureFlag.load(feature).permissionedAddresses.values();
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function isFeatureAllowed(
        bytes32 feature,
        address account
    ) external view override returns (bool) {
        return FeatureFlag.hasAccess(feature, account);
    }
}
