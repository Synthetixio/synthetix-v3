//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

import "../../interfaces/IPoolModule.sol";
import "../../storage/Pool.sol";

import "hardhat/console.sol";

contract PoolModule is IPoolModule, OwnableMixin {
    error PoolAlreadyExists(uint128 poolId);
    error InvalidParameters(string incorrectParameter, string help);
    error PoolNotFound(uint128 poolId);
    error CapacityLocked(uint marketId);

    using Pool for Pool.Data;
    using Market for Market.Data;

    modifier onlyPoolOwner(uint128 poolId, address requestor) {
        if (Pool.load(poolId).owner != requestor) {
            revert AccessError.Unauthorized(requestor);
        }

        _;
    }

    function createPool(uint128 requestedPoolId, address owner) external override {
        if (owner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (Pool.exists(requestedPoolId)) {
            revert PoolAlreadyExists(requestedPoolId);
        }

        Pool.create(requestedPoolId, owner);

        emit PoolCreated(requestedPoolId, owner);
    }

    // ---------------------------------------
    // Ownership
    // ---------------------------------------
    function nominatePoolOwner(address nominatedOwner, uint128 poolId) external override onlyPoolOwner(poolId, msg.sender) {
        Pool.load(poolId).nominatedOwner = nominatedOwner;

        emit NominatedPoolOwner(poolId, nominatedOwner);
    }

    function acceptPoolOwnership(uint128 poolId) external override {
        Pool.Data storage pool = Pool.load(poolId);
        if (pool.nominatedOwner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        pool.owner = msg.sender;
        pool.nominatedOwner = address(0);

        emit PoolOwnershipAccepted(poolId, msg.sender);
    }

    function renouncePoolNomination(uint128 poolId) external override {
        Pool.Data storage pool = Pool.load(poolId);
        if (pool.nominatedOwner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        pool.nominatedOwner = address(0);

        emit PoolNominationRenounced(poolId, msg.sender);
    }

    function getPoolOwner(uint128 poolId) external view override returns (address) {
        return Pool.load(poolId).owner;
    }

    function getNominatedPoolOwner(uint128 poolId) external view override returns (address) {
        return Pool.load(poolId).nominatedOwner;
    }

    function renouncePoolOwnership(uint128 poolId) external override onlyPoolOwner(poolId, msg.sender) {
        Pool.load(poolId).nominatedOwner = address(0);

        emit PoolOwnershipRenounced(poolId, msg.sender);
    }

    // ---------------------------------------
    // pool admin
    // ---------------------------------------
    function setPoolConfiguration(
        uint128 poolId,
        MarketDistribution.Data[] memory newDistributions
    ) external override poolExists(poolId) onlyPoolOwner(poolId, msg.sender) {
        Pool.Data storage pool = Pool.load(poolId);

        // TODO: this is not super efficient. we only call this to gather the debt accumulated from deployed pools
        // would be better if we could eliminate the call at the end somehow
        pool.distributeDebt();

        uint128[] memory postVerifyLock = _verifyPoolConfigurationChange(pool, newDistributions);

        uint totalWeight = 0;

        // now actually modify the storage
        uint i = 0;
        for (
            ;
            i < (newDistributions.length < pool.poolDistribution.length ? newDistributions.length : pool.poolDistribution.length);
            i++
        ) {

            pool.poolDistribution[i] = newDistributions[i];
            totalWeight += newDistributions[i].weight;
        }

        for (; i < newDistributions.length; i++) {
            pool.poolDistribution.push(newDistributions[i]);
            totalWeight += newDistributions[i].weight;
        }

        uint popped = pool.poolDistribution.length - i;
        for (i = 0; i < popped; i++) {
            Market.rebalance(pool.poolDistribution[pool.poolDistribution.length - 1].market, poolId, 0, 0);
            pool.poolDistribution.pop();
        }

        pool.totalWeights = uint128(totalWeight);

        pool.rebalanceConfigurations();

        for (i = 0; i < postVerifyLock.length && postVerifyLock[i] != 0; i++) {
            if (Market.load(postVerifyLock[i]).isCapacityLocked()) {
                revert CapacityLocked(postVerifyLock[i]);
            }
        }

        emit PoolConfigurationSet(poolId, newDistributions, msg.sender);
    }

    function getPoolConfiguration(uint128 poolId)
        external
        view
        override
        returns (
            MarketDistribution.Data[] memory
        )
    {
        Pool.Data storage pool = Pool.load(poolId);

        MarketDistribution.Data[] memory distributions = new MarketDistribution.Data[](pool.poolDistribution.length);

        for (uint i = 0; i < pool.poolDistribution.length; i++) {
            distributions[i] = pool.poolDistribution[i];
        }

        return distributions;
    }

    function setPoolName(uint128 poolId, string memory name)
        external
        override
        poolExists(poolId)
        onlyPoolOwner(poolId, msg.sender)
    {
        Pool.load(poolId).name = name;

        emit PoolNameUpdated(poolId, name, msg.sender);
    }

    function getPoolName(uint128 poolId) external view override returns (string memory poolName) {
        return Pool.load(poolId).name;
    }

    // ---------------------------------------
    // system owner
    // ---------------------------------------
    function setMinLiquidityRatio(uint minLiquidityRatio) external override onlyOwner {
        PoolConfiguration.load().minLiquidityRatio = minLiquidityRatio;
    }

    function getMinLiquidityRatio() external view override returns (uint) {
        return PoolConfiguration.load().minLiquidityRatio;
    }

    function _verifyPoolConfigurationChange(
        Pool.Data storage pool,
        MarketDistribution.Data[] memory newDistributions
    ) internal view returns (uint128[] memory postVerifyLock) {
        uint oldIdx = 0;
        uint postVerifyLockIdx = 0;
        uint128 lastMarketId = 0;

        postVerifyLock = new uint128[](newDistributions.length);

        for (uint i = 0; i < newDistributions.length; i++) {
            if (newDistributions[i].market <= lastMarketId) {
                revert InvalidParameters("markets", "must be supplied in strictly ascending order");
            }
            lastMarketId = newDistributions[i].market;

            if (newDistributions[i].weight == 0) {
                revert InvalidParameters("weights", "weight must be non-zero");
            }

            while (oldIdx < pool.poolDistribution.length && pool.poolDistribution[oldIdx].market < newDistributions[i].market) {
                // market has been removed

                // need to verify market is not capacity locked 
                postVerifyLock[postVerifyLockIdx++] = pool.poolDistribution[oldIdx].market;

                oldIdx++;
            }

            if (oldIdx < pool.poolDistribution.length && pool.poolDistribution[oldIdx].market == newDistributions[i].market) {
                // market has been updated

                // any divestment requires verify of capacity lock
                if (
                    pool.poolDistribution[oldIdx].maxDebtShareValue < newDistributions[i].maxDebtShareValue || 
                    pool.poolDistribution[oldIdx].weight < newDistributions[i].weight
                ) {
                    postVerifyLock[postVerifyLockIdx++] = newDistributions[i].market;
                }
            }
            else {
                // market has been added
                // (no checks for now)
            }
        }

        while (oldIdx < pool.poolDistribution.length) {
            // market has been removed
            oldIdx++;
        }
    }

    modifier poolExists(uint128 poolId) {
        if (!Pool.exists(poolId)) {
            revert PoolNotFound(poolId);
        }

        _;
    }
}
