//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "../storage/FeatureFlag.sol";

import "../interfaces/IFeatureFlagModule.sol";

/**
 * @title Module for granular enabling and disabling of system features and functions.
 * See IFeatureFlagModule.
 */
contract FeatureFlagModule is IFeatureFlagModule {
    using SetUtil for SetUtil.AddressSet;
    using FeatureFlag for FeatureFlag.Data;

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function setFeatureFlagAllowAll(bytes32 feature, bool allowAll) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load(feature).allowAll = allowAll;

        if (allowAll) {
            FeatureFlag.load(feature).denyAll = false;
        }

        emit FeatureFlagAllowAllSet(feature, allowAll);
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function setFeatureFlagDenyAll(bytes32 feature, bool denyAll) external override {
        FeatureFlag.Data storage flag = FeatureFlag.load(feature);

        if (!denyAll || !flag.isDenier(msg.sender)) {
            OwnableStorage.onlyOwner();
        }

        flag.denyAll = denyAll;

        emit FeatureFlagDenyAllSet(feature, denyAll);
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function addToFeatureFlagAllowlist(bytes32 feature, address account) external override {
        OwnableStorage.onlyOwner();

        SetUtil.AddressSet storage permissionedAddresses = FeatureFlag
            .load(feature)
            .permissionedAddresses;

        if (!permissionedAddresses.contains(account)) {
            permissionedAddresses.add(account);
            emit FeatureFlagAllowlistAdded(feature, account);
        }
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function removeFromFeatureFlagAllowlist(bytes32 feature, address account) external override {
        OwnableStorage.onlyOwner();

        SetUtil.AddressSet storage permissionedAddresses = FeatureFlag
            .load(feature)
            .permissionedAddresses;

        if (permissionedAddresses.contains(account)) {
            FeatureFlag.load(feature).permissionedAddresses.remove(account);
            emit FeatureFlagAllowlistRemoved(feature, account);
        }
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function setDeniers(bytes32 feature, address[] memory deniers) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.Data storage flag = FeatureFlag.load(feature);

        // resize array (its really dumb how you have to do this)
        uint storageLen = flag.deniers.length;
        for (uint i = storageLen; i > deniers.length; i--) {
            flag.deniers.pop();
        }

        for (uint i = 0; i < deniers.length; i++) {
            if (i >= storageLen) {
                flag.deniers.push(deniers[i]);
            } else {
                flag.deniers[i] = deniers[i];
            }
        }

        emit FeatureFlagDeniersReset(feature, deniers);
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function getDeniers(bytes32 feature) external view override returns (address[] memory) {
        FeatureFlag.Data storage flag = FeatureFlag.load(feature);
        address[] memory addrs = new address[](flag.deniers.length);
        for (uint i = 0; i < addrs.length; i++) {
            addrs[i] = flag.deniers[i];
        }

        return addrs;
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
    function getFeatureFlagDenyAll(bytes32 feature) external view override returns (bool) {
        return FeatureFlag.load(feature).denyAll;
    }

    /**
     * @inheritdoc IFeatureFlagModule
     */
    function getFeatureFlagAllowlist(
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
