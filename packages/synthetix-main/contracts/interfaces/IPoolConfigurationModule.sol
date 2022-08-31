//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing preferred and approved pools via SCCPs
interface IPoolConfigurationModule {
    event PreferredPoolSet(uint256 poolId);
    event PoolApprovedAdded(uint256 poolId);
    event PoolApprovedRemoved(uint256 poolId);

    /// @notice SCCP sets the preferred pool
    function setPreferredPool(uint poolId) external;

    /// @notice SCCP adds a poolId to the approved list
    function addApprovedPool(uint poolId) external;

    /// @notice SCCP removes a poolId to the approved list
    function removeApprovedPool(uint poolId) external;

    /// @notice gets the preferred pool
    function getPreferredPool() external view returns (uint);

    /// @notice gets the approved pools (list of poolIds)
    function getApprovedPools() external view returns (uint[] calldata);
}
