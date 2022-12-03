//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title PoolConfigurationModule interface.
 * @noticeAllows the system owner to mark official pools.
 */
interface IPoolConfigurationModule {
    event PreferredPoolSet(uint256 poolId);
    event PoolApprovedAdded(uint256 poolId);
    event PoolApprovedRemoved(uint256 poolId);

    /**
     * @notice Sets the unique system preferred pool.
     * @dev Note: The preferred pool does not receive any special treatment. It is only signaled as preferred here.
     */
    function setPreferredPool(uint128 poolId) external;

    /**
     * @notice Marks a pool as approved by the system owner.
     * @dev Approved pools do not receive any special treatment. They are only signaled as approved here.
     */
    function addApprovedPool(uint128 poolId) external;

    /**
     * @notice Un-marks a pool as preferred by the system owner.
     */
    function removeApprovedPool(uint128 poolId) external;

    /**
     * @notice Retrieves the unique system preferred pool.
     */
    function getPreferredPool() external view returns (uint);

    /**
     * @notice Retrieves the pool that are approved by the system owner.
     */
    function getApprovedPools() external view returns (uint[] calldata);
}
