//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Module for granular enabling and disabling of system features and functions.
 *
 * Interface functions that are controlled by a feature flag simply need to add this line to their body:
 * `FeatureFlag.ensureAccessToFeature(FLAG_ID);`
 *
 * If such a line is not present in a function, then it is not controlled by a feature flag.
 *
 * If a feature flag is set and then removed forever, consider deleting the line mentioned above from the function's body.
 */
interface IFeatureFlagModule {
    /**
     * @notice Emitted when general access has been given or removed for a feature.
     * @param feature The bytes32 id of the feature.
     * @param allowAll True if the feature was allowed for everyone and false if it is only allowed for those included in the allowlist.
     */
    event FeatureFlagAllowAllSet(bytes32 feature, bool allowAll);

    /**
     * @notice Emitted when an address was given access to a feature.
     * @param feature The bytes32 id of the feature.
     * @param account The address that was given access to the feature.
     */
    event FeatureFlagAllowlistAdded(bytes32 feature, address account);

    /**
     * @notice Emitted when access to a feature has been removed from an address.
     * @param feature The bytes32 id of the feature.
     * @param account The address that no longer has access to the feature.
     */
    event FeatureFlagAllowlistRemoved(bytes32 feature, address account);

    /**
     * @notice Enables or disables free access to a feature.
     * @param feature The bytes32 id of the feature.
     * @param allowAll True to allow anyone to use the feature, false to fallback to the allowlist.
     */
    function setFeatureFlagAllowAll(bytes32 feature, bool allowAll) external;

    /**
     * @notice Allows an address to use a feature.
     * @param feature The bytes32 id of the feature.
     * @param account The address that is allowed to use the feature.
     */
    function addToFeatureFlagAllowlist(bytes32 feature, address account) external;

    /**
     * @notice Disallows an address from using a feature.
     * @param feature The bytes32 id of the feature.
     * @param account The address that is disallowed from using the feature.
     */
    function removeFromFeatureFlagAllowlist(bytes32 feature, address account) external;

    /**
     * @notice Determines if the given feature is freely allowed to all users.
     * @param feature The bytes32 id of the feature.
     * @return True if anyone is allowed to use the feature, false if per-user control is used.
     */
    function getFeatureFlagAllowAll(bytes32 feature) external view returns (bool);

    /**
     * @notice Returns a list of addresses that are allowed to use the specified feature.
     * @param feature The bytes32 id of the feature.
     * @return The queried list of addresses.
     */
    function getFeatureFlagAllowlist(bytes32 feature) external view returns (address[] memory);

    /**
     * @notice Determines if an address can use the specified feature.
     * @param feature The bytes32 id of the feature.
     * @param account The address that is being queried for access to the feature.
     * @return A boolean with the response to the query.
     */
    function isFeatureAllowed(bytes32 feature, address account) external view returns (bool);
}
