//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module that allows the system owner to mark official pools.
 */
interface IPoolConfigurationModule {
    /**
     * @notice Emitted when the system owner sets the preferred pool.
     * @param poolId The id of the pool that was set as preferred.
     */
    event PreferredPoolSet(uint256 poolId);

    /**
     * @notice Emitted when the system owner adds an approved pool.
     * @param poolId The id of the pool that was approved.
     */
    event PoolApprovedAdded(uint256 poolId);

    /**
     * @notice Emitted when the system owner removes an approved pool.
     * @param poolId The id of the pool that is no longer approved.
     */
    event PoolApprovedRemoved(uint256 poolId);

    /**
     * @notice Sets the unique system preferred pool.
     * @dev Note: The preferred pool does not receive any special treatment. It is only signaled as preferred here.
     * @param poolId The id of the pool that is to be set as preferred.
     */
    function setPreferredPool(uint128 poolId) external;

    /**
     * @notice Marks a pool as approved by the system owner.
     * @dev Approved pools do not receive any special treatment. They are only signaled as approved here.
     * @param poolId The id of the pool that is to be approved.
     */
    function addApprovedPool(uint128 poolId) external;

    /**
     * @notice Un-marks a pool as preferred by the system owner.
     * @param poolId The id of the pool that is to be no longer approved.
     */
    function removeApprovedPool(uint128 poolId) external;

    /**
     * @notice Retrieves the unique system preferred pool.
     * @return poolId The id of the pool that is currently set as preferred in the system.
     */
    function getPreferredPool() external view returns (uint128 poolId);

    /**
     * @notice Retrieves the pool that are approved by the system owner.
     * @return poolIds An array with all of the pool ids that are approved in the system.
     */
    function getApprovedPools() external view returns (uint256[] calldata poolIds);
}
