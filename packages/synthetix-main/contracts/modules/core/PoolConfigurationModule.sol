//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../../interfaces/IPoolConfigurationModule.sol";
import "../../storage/PoolConfiguration.sol";

import "../../storage/Pool.sol";

contract PoolConfigurationModule is IPoolConfigurationModule, OwnableMixin {
    using SetUtil for SetUtil.UintSet;

    using Pool for Pool.Data;

    error PoolNotFound(uint128 poolId);

    function setPreferredPool(uint128 poolId) external override onlyOwner poolExists(poolId) {
        PoolConfiguration.load().preferredPool = poolId;

        emit PreferredPoolSet(poolId);
    }

    function getPreferredPool() external view override returns (uint) {
        return PoolConfiguration.load().preferredPool;
    }

    function addApprovedPool(uint128 poolId) external override onlyOwner poolExists(poolId) {
        PoolConfiguration.load().approvedPools.add(poolId);

        emit PoolApprovedAdded(poolId);
    }

    function removeApprovedPool(uint128 poolId) external override onlyOwner poolExists(poolId) {
        PoolConfiguration.load().approvedPools.remove(poolId);

        emit PoolApprovedRemoved(poolId);
    }

    function getApprovedPools() external view override returns (uint[] memory) {
        return PoolConfiguration.load().approvedPools.values();
    }

    modifier poolExists(uint128 poolId) {
        if (!Pool.exists(poolId)) {
            revert PoolNotFound(poolId);
        }
        _;
    }
}
