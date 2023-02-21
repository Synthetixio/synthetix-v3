//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../../interfaces/IPoolConfigurationModule.sol";
import "../../storage/SystemPoolConfiguration.sol";

import "../../storage/Pool.sol";

/**
 * @title Module that allows the system owner to mark official pools.
 * @dev See IPoolConfigurationModule.
 */
contract PoolConfigurationModule is IPoolConfigurationModule {
    using SetUtil for SetUtil.UintSet;

    using Pool for Pool.Data;

    /**
     * @inheritdoc IPoolConfigurationModule
     */
    function setPreferredPool(uint128 poolId) external override {
        OwnableStorage.onlyOwner();
        Pool.loadExisting(poolId);

        SystemPoolConfiguration.load().preferredPool = poolId;

        emit PreferredPoolSet(poolId);
    }

    /**
     * @inheritdoc IPoolConfigurationModule
     */
    function getPreferredPool() external view override returns (uint128) {
        return SystemPoolConfiguration.load().preferredPool;
    }

    /**
     * @inheritdoc IPoolConfigurationModule
     */
    function addApprovedPool(uint128 poolId) external override {
        OwnableStorage.onlyOwner();
        Pool.loadExisting(poolId);

        SystemPoolConfiguration.load().approvedPools.add(poolId);

        emit PoolApprovedAdded(poolId);
    }

    /**
     * @inheritdoc IPoolConfigurationModule
     */
    function removeApprovedPool(uint128 poolId) external override {
        OwnableStorage.onlyOwner();
        Pool.loadExisting(poolId);

        SystemPoolConfiguration.load().approvedPools.remove(poolId);

        emit PoolApprovedRemoved(poolId);
    }

    /**
     * @inheritdoc IPoolConfigurationModule
     */
    function getApprovedPools() external view override returns (uint256[] memory) {
        return SystemPoolConfiguration.load().approvedPools.values();
    }
}
