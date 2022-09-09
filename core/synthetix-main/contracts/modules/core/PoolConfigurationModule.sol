//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "../../interfaces/IPoolConfigurationModule.sol";
import "../../storage/PoolConfigurationStorage.sol";
import "../../mixins/PoolMixin.sol";

contract PoolConfigurationModule is IPoolConfigurationModule, PoolConfigurationStorage, PoolMixin, OwnableMixin {
    using SetUtil for SetUtil.UintSet;

    function setPreferredPool(uint poolId) external override onlyOwner poolExists(poolId) {
        _poolConfigurationStore().preferredPool = poolId;

        emit PreferredPoolSet(poolId);
    }

    function getPreferredPool() external view override returns (uint) {
        return _poolConfigurationStore().preferredPool;
    }

    function addApprovedPool(uint poolId) external override onlyOwner poolExists(poolId) {
        _poolConfigurationStore().approvedPools.add(poolId);

        emit PoolApprovedAdded(poolId);
    }

    function removeApprovedPool(uint poolId) external override onlyOwner poolExists(poolId) {
        _poolConfigurationStore().approvedPools.remove(poolId);

        emit PoolApprovedRemoved(poolId);
    }

    function getApprovedPools() external view override returns (uint[] memory) {
        return _poolConfigurationStore().approvedPools.values();
    }
}
