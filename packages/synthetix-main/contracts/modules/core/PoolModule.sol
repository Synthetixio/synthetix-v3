//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

import "../../interfaces/IPoolModule.sol";
import "../../storage/Pool.sol";

contract PoolModule is IPoolModule {
    error InvalidParameters(string incorrectParameter, string help);
    error PoolNotFound(uint128 poolId);
    error CapacityLocked(uint marketId);

    using DecimalMath for uint;

    using Pool for Pool.Data;
    using Market for Market.Data;

    bytes32 private constant _POOL_FEATURE_FLAG = "createPool";

    function createPool(uint128 requestedPoolId, address owner) external override {
        FeatureFlag.ensureAccessToFeature(_POOL_FEATURE_FLAG);

        if (owner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        Pool.create(requestedPoolId, owner);

        emit PoolCreated(requestedPoolId, owner);
    }

    // ---------------------------------------
    // Ownership
    // ---------------------------------------
    function nominatePoolOwner(address nominatedOwner, uint128 poolId) external override {
        Pool.onlyPoolOwner(poolId, msg.sender);

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

    function revokePoolNomination(uint128 poolId) external override {
        Pool.onlyPoolOwner(poolId, msg.sender);

        Pool.load(poolId).nominatedOwner = address(0);

        emit PoolNominationRevoked(poolId, msg.sender);
    }

    function renouncePoolOwnership(uint128 poolId) external override {
        Pool.Data storage pool = Pool.load(poolId);

        if (pool.nominatedOwner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        pool.nominatedOwner = address(0);

        emit PoolOwnershipRenounced(poolId, msg.sender);
    }

    function getPoolOwner(uint128 poolId) external view override returns (address) {
        return Pool.load(poolId).owner;
    }

    function getNominatedPoolOwner(uint128 poolId) external view override returns (address) {
        return Pool.load(poolId).nominatedOwner;
    }

    // ---------------------------------------
    // pool admin
    // ---------------------------------------
    // TODO: Rename newDistributions to newMarketConfigurations
    function setPoolConfiguration(uint128 poolId, MarketConfiguration.Data[] memory newDistributions) external override {
        Pool.requireExists(poolId);
        Pool.onlyPoolOwner(poolId, msg.sender);
        Pool.Data storage pool = Pool.load(poolId);

        // TODO: this is not super efficient. we only call this to gather the debt accumulated from deployed pools
        // would be better if we could eliminate the call at the end somehow
        pool.distributeDebt();

        (uint128[] memory postVerifyLocks, uint128[] memory removedMarkets) = _verifyPoolConfigurationChange(
            pool,
            newDistributions
        );

        uint totalWeight = 0;

        // now actually modify the storage
        uint i = 0;
        for (
            ;
            i <
            (
                newDistributions.length < pool.marketConfigurations.length
                    ? newDistributions.length
                    : pool.marketConfigurations.length
            );
            i++
        ) {
            pool.marketConfigurations[i] = newDistributions[i];
            totalWeight += newDistributions[i].weight;
        }

        for (; i < newDistributions.length; i++) {
            pool.marketConfigurations.push(newDistributions[i]);
            totalWeight += newDistributions[i].weight;
        }

        // remove any excess
        uint popped = pool.marketConfigurations.length - i;
        for (i = 0; i < popped; i++) {
            pool.marketConfigurations.pop();
        }

        // edge case: removed markets (markets which should be implicitly set to `0` as a result of not being included)
        for (i = 0; i < removedMarkets.length && removedMarkets[i] != 0; i++) {
            Market.rebalance(removedMarkets[i], poolId, 0, 0);
        }

        pool.totalWeights = uint128(totalWeight);

        pool.distributeDebt();

        for (i = 0; i < postVerifyLocks.length && postVerifyLocks[i] != 0; i++) {
            if (Market.load(postVerifyLocks[i]).isCapacityLocked()) {
                revert CapacityLocked(postVerifyLocks[i]);
            }
        }

        emit PoolConfigurationSet(poolId, newDistributions, msg.sender);
    }

    function getPoolConfiguration(uint128 poolId) external view override returns (MarketConfiguration.Data[] memory) {
        Pool.Data storage pool = Pool.load(poolId);

        MarketConfiguration.Data[] memory marketConfigurations = new MarketConfiguration.Data[](
            pool.marketConfigurations.length
        );

        for (uint i = 0; i < pool.marketConfigurations.length; i++) {
            marketConfigurations[i] = pool.marketConfigurations[i];
        }

        return marketConfigurations;
    }

    function setPoolName(uint128 poolId, string memory name) external override {
        Pool.requireExists(poolId);
        Pool.onlyPoolOwner(poolId, msg.sender);

        Pool.load(poolId).name = name;

        emit PoolNameUpdated(poolId, name, msg.sender);
    }

    function getPoolName(uint128 poolId) external view override returns (string memory poolName) {
        return Pool.load(poolId).name;
    }

    // ---------------------------------------
    // system owner
    // ---------------------------------------
    function setMinLiquidityRatio(uint minLiquidityRatio) external override {
        OwnableStorage.onlyOwner();

        PoolConfiguration.load().minLiquidityRatio = minLiquidityRatio;
    }

    function getMinLiquidityRatio() external view override returns (uint) {
        return PoolConfiguration.load().minLiquidityRatio;
    }

    function _verifyPoolConfigurationChange(Pool.Data storage pool, MarketConfiguration.Data[] memory newDistributions)
        internal
        view
        returns (uint128[] memory postVerifyLocks, uint128[] memory removedMarkets)
    {
        uint oldIdx = 0;
        uint postVerifyLocksIdx = 0;
        uint removedMarketsIdx = 0;
        uint128 lastMarketId = 0;

        postVerifyLocks = new uint128[](pool.marketConfigurations.length);
        removedMarkets = new uint128[](pool.marketConfigurations.length);

        // first we need the total weight of the new distribution
        uint totalWeight = 0;
        for (uint i = 0; i < newDistributions.length; i++) {
            totalWeight += newDistributions[i].weight;
        }

        for (uint i = 0; i < newDistributions.length; i++) {
            if (newDistributions[i].market <= lastMarketId) {
                revert InvalidParameters("markets", "must be supplied in strictly ascending order");
            }
            lastMarketId = newDistributions[i].market;

            if (newDistributions[i].weight == 0) {
                revert InvalidParameters("weights", "weight must be non-zero");
            }

            while (
                oldIdx < pool.marketConfigurations.length &&
                pool.marketConfigurations[oldIdx].market < newDistributions[i].market
            ) {
                // market has been removed

                // need to verify market is not capacity locked
                postVerifyLocks[postVerifyLocksIdx++] = pool.marketConfigurations[oldIdx].market;
                removedMarkets[removedMarketsIdx++] = postVerifyLocks[postVerifyLocksIdx - 1];

                oldIdx++;
            }

            if (
                oldIdx < pool.marketConfigurations.length &&
                pool.marketConfigurations[oldIdx].market == newDistributions[i].market
            ) {
                // market has been updated

                // any divestment requires verify of capacity lock
                // multiply by 1e9 to make sure we have comparable precision in case of very small values
                if (
                    newDistributions[i].maxDebtShareValue < pool.marketConfigurations[oldIdx].maxDebtShareValue ||
                    uint(newDistributions[i].weight * 1e9).divDecimal(totalWeight) <
                    uint(pool.marketConfigurations[oldIdx].weight * 1e9).divDecimal(pool.totalWeights)
                ) {
                    postVerifyLocks[postVerifyLocksIdx++] = newDistributions[i].market;
                }

                oldIdx++;
            }
            // else {
            // market has been added
            // (no checks for now)
            //}
        }

        while (oldIdx < pool.marketConfigurations.length) {
            // market has been removed
            removedMarkets[removedMarketsIdx++] = pool.marketConfigurations[oldIdx].market;
            oldIdx++;
        }
    }
}
