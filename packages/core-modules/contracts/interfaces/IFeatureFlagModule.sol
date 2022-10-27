//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Interface for feature flags
interface IFeatureFlagModule {
    /// @notice Set a feature flag
    function setFeatureFlag(bytes32 feature, bool value) external;

    /// @notice Add an address and give it permission for a feature flag
    function addToFeatureFlag(bytes32 feature, address permissioned) external;

    /// @notice Remove an address and remove its permission for a feature flag
    function removeFromFeatureFlag(bytes32 feature, address permissioned) external;

    /// @notice Returns if feature flag is enabled
    function isFeatureFlagEnabled(bytes32 feature) external view returns (bool);

    /// @notice Returns the addresses that have permission for a feature flag
    function getFeatureFlagPermissionedAddresses(bytes32 feature) external view returns (address[] memory);
}
