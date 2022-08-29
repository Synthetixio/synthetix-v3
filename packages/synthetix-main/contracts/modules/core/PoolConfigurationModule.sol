//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";

import "../../interfaces/IPoolConfigurationModule.sol";
import "../../storage/PoolConfigurationStorage.sol";
import "../../mixins/PoolMixin.sol";
import "../../submodules/PoolEventAndErrors.sol";

contract PoolConfigurationModule is
    IPoolConfigurationModule,
    PoolConfigurationStorage,
    PoolEventAndErrors,
    PoolMixin,
    OwnableMixin
{
    function setPreferredPool(uint poolId) external override onlyOwner poolExists(poolId) {
        _poolConfigurationStore().preferredPool = poolId;

        emit PreferredPoolSet(poolId);
    }

    function getPreferredPool() external view override returns (uint) {
        return _poolConfigurationStore().preferredPool;
    }

    function addApprovedPool(uint poolId) external override onlyOwner poolExists(poolId) {
        for (uint i = 0; i < _poolConfigurationStore().approvedPools.length; i++) {
            if (_poolConfigurationStore().approvedPools[i] == poolId) {
                revert PoolAlreadyApproved(poolId);
            }
        }

        _poolConfigurationStore().approvedPools.push(poolId);

        emit PoolApprovedAdded(poolId);
    }

    function removeApprovedPool(uint poolId) external override onlyOwner poolExists(poolId) {
        bool found;
        for (uint i = 0; i < _poolConfigurationStore().approvedPools.length; i++) {
            if (_poolConfigurationStore().approvedPools[i] == poolId) {
                _poolConfigurationStore().approvedPools[i] = _poolConfigurationStore().approvedPools[
                    _poolConfigurationStore().approvedPools.length - 1
                ];
                _poolConfigurationStore().approvedPools.pop();
                found = true;
                break;
            }
        }

        if (!found) {
            revert PoolNotFound(poolId);
        }

        emit PoolApprovedRemoved(poolId);
    }

    function getApprovedPools() external view override returns (uint[] memory) {
        return _poolConfigurationStore().approvedPools;
    }
}
