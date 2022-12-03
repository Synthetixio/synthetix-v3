//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Interface for feature flags
interface IFeatureFlagModule {
    /// @notice Set a feature flag to either allow all or not
    function setFeatureFlagAllowAll(bytes32 feature, bool allowAll) external;

    /// @notice Add an address and give it permission for a feature flag
    function addToFeatureFlagAllowlist(bytes32 feature, address permissioned) external;

    /// @notice Remove an address and remove its permission for a feature flag
    function removeFromFeatureFlagAllowlist(bytes32 feature, address permissioned) external;

    /// @notice Returns allowAll boolean value for a feature flag
    function getFeatureFlagAllowAll(bytes32 feature) external view returns (bool);

    /// @notice Returns the addresses that have permission for a feature flag
    function getFeatureFlagAllowlist(bytes32 feature) external view returns (address[] memory);

    /// @notice Check if address has access to feature
    function isFeatureAllowed(bytes32 feature, address addressToCheck) external view returns (bool);
}
