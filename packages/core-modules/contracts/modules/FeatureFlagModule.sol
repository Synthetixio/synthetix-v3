//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "../storage/FeatureFlag.sol";

import "../interfaces/IFeatureFlag.sol";

contract FeatureFlagModule is IFeatureFlag {
    using SetUtil for SetUtil.AddressSet;

    event FeatureFlagSet(bytes32 feature, bool value);
    event FeatureFlagAddressAdded(bytes32 feature, address account);
    event FeatureFlagAddressRemoved(bytes32 feature, address account);

    function setFeatureFlag(bytes32 feature, bool value) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load().featureFlags[feature].enabled = value;

        emit FeatureFlagSet(feature, value);
    }

    function addToFeatureFlag(bytes32 feature, address permissioned) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load().featureFlags[feature].permissionedAddresses.add(permissioned);

        emit FeatureFlagAddressAdded(feature, permissioned);
    }

    function addToFeatureFlag(bytes32 feature, address[] calldata permissioned) external override {
        OwnableStorage.onlyOwner();

        FeatureFlag.Data storage data = FeatureFlag.load();
        
        for (uint i = 0; i < permissioned.length; i++) {
            data.featureFlags[feature].permissionedAddresses.add(permissioned[i]);
            emit FeatureFlagAddressAdded(feature, permissioned[i]);
        }
    }

    function removeFromFeatureFlag(bytes32 feature, address permissioned) external override {
        OwnableStorage.onlyOwner();
        FeatureFlag.load().featureFlags[feature].permissionedAddresses.remove(permissioned);

        emit FeatureFlagAddressRemoved(feature, permissioned);
    }

    function removeFromFeatureFlag(bytes32 feature, address[] calldata permissioned) external override {
        OwnableStorage.onlyOwner();

        FeatureFlag.Data storage data = FeatureFlag.load();
        
        for (uint i = 0; i < permissioned.length; i++) {
            data.featureFlags[feature].permissionedAddresses.remove(permissioned[i]);
            emit FeatureFlagAddressRemoved(feature, permissioned[i]);
        }
    }
}
