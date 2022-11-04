//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../../interfaces/IPoolConfigurationModule.sol";
import "../../storage/PoolConfiguration.sol";

import "../../storage/Pool.sol";

contract PoolConfigurationModule is IPoolConfigurationModule {
    using SetUtil for SetUtil.UintSet;

    using Pool for Pool.Data;

    function setPreferredPool(uint128 poolId) external override {
        OwnableStorage.onlyOwner();
        Pool.requireExists(poolId);

        PoolConfiguration.load().preferredPool = poolId;

        emit PreferredPoolSet(poolId);
    }

    function getPreferredPool() external view override returns (uint) {
        return PoolConfiguration.load().preferredPool;
    }

    function addApprovedPool(uint128 poolId) external override {
        OwnableStorage.onlyOwner();
        Pool.requireExists(poolId);

        PoolConfiguration.load().approvedPools.add(poolId);

        emit PoolApprovedAdded(poolId);
    }

    function removeApprovedPool(uint128 poolId) external override {
        OwnableStorage.onlyOwner();
        Pool.requireExists(poolId);

        PoolConfiguration.load().approvedPools.remove(poolId);

        emit PoolApprovedRemoved(poolId);
    }

    function getApprovedPools() external view override returns (uint[] memory) {
        return PoolConfiguration.load().approvedPools.values();
    }
}
