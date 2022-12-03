//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../../interfaces/IPoolConfigurationModule.sol";
import "../../storage/SystemPoolConfiguration.sol";

import "../../storage/Pool.sol";

/**
 * @dev Allows the system owner to mark official pools.
 */
contract PoolConfigurationModule is IPoolConfigurationModule {
    using SetUtil for SetUtil.UintSet;

    using Pool for Pool.Data;

    /**
     * @dev Sets the unique system preferred pool.
     *
     * Note: The preferred pool does not receive any special treatment. It is only signaled as preferred here.
     */
    function setPreferredPool(uint128 poolId) external override {
        OwnableStorage.onlyOwner();
        Pool.requireExists(poolId);

        SystemPoolConfiguration.load().preferredPool = poolId;

        emit PreferredPoolSet(poolId);
    }

    /**
     * @dev Retrieves the unique system preferred pool.
     */
    function getPreferredPool() external view override returns (uint) {
        return SystemPoolConfiguration.load().preferredPool;
    }

    /**
     * @dev Marks a pool as approved by the system owner.
     *
     * Note: Approved pools do not receive any special treatment. They are only signaled as approved here.
     */
    function addApprovedPool(uint128 poolId) external override {
        OwnableStorage.onlyOwner();
        Pool.requireExists(poolId);

        SystemPoolConfiguration.load().approvedPools.add(poolId);

        emit PoolApprovedAdded(poolId);
    }

    /**
     * @dev Un-marks a pool as preferred by the system owner.
     */
    function removeApprovedPool(uint128 poolId) external override {
        OwnableStorage.onlyOwner();
        Pool.requireExists(poolId);

        SystemPoolConfiguration.load().approvedPools.remove(poolId);

        emit PoolApprovedRemoved(poolId);
    }

    /**
     * @dev Retrieves the pool that are approved by the system owner.
     */
    function getApprovedPools() external view override returns (uint[] memory) {
        return SystemPoolConfiguration.load().approvedPools.values();
    }
}
