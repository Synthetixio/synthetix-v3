//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "../../interfaces/IPoolModule.sol";
import "../../storage/Pool.sol";

contract PoolModule is IPoolModule {
    error CapacityLocked(uint marketId);

    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;

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

    // ---------------------------------------
    // pool admin
    // ---------------------------------------
    function setPoolConfiguration(uint128 poolId, MarketConfiguration.Data[] memory newMarketConfigurations)
        external
        override
    {
        Pool.requireExists(poolId);
        Pool.onlyPoolOwner(poolId, msg.sender);
        Pool.Data storage pool = Pool.load(poolId);

        // This follows same pattern that Pool.recalculateVaultCollateral() where we need to distribute the debt, adjust the market configurations and distribute again
        // Update each market's pro-rata liquidity and collect accumulated debt into the pool's debt distribution.
        pool.distributeDebtToVaults();

        (uint128[] memory postVerifyLocks, uint128[] memory removedMarkets) = _verifyPoolConfigurationChange(
            pool,
            newMarketConfigurations
        );

        uint totalWeight = 0;

        // now actually modify the storage
        uint i = 0;
        for (
            ;
            i <
            (
                newMarketConfigurations.length < pool.marketConfigurations.length
                    ? newMarketConfigurations.length
                    : pool.marketConfigurations.length
            );
            i++
        ) {
            pool.marketConfigurations[i] = newMarketConfigurations[i];
            totalWeight += newMarketConfigurations[i].weightD18;
        }

        for (; i < newMarketConfigurations.length; i++) {
            pool.marketConfigurations.push(newMarketConfigurations[i]);
            totalWeight += newMarketConfigurations[i].weightD18;
        }

        // remove any excess
        uint popped = pool.marketConfigurations.length - i;
        for (i = 0; i < popped; i++) {
            pool.marketConfigurations.pop();
        }

        // edge case: removed markets (markets which should be implicitly set to `0` as a result of not being included)
        for (i = 0; i < removedMarkets.length && removedMarkets[i] != 0; i++) {
            Market.rebalancePools(removedMarkets[i], poolId, 0, 0);
        }

        pool.totalWeightsD18 = totalWeight.to128();

        // Distribute debt again because the unused credit capacity has been updated, and this information needs to be propagated immediately.
        pool.distributeDebtToVaults();

        for (i = 0; i < postVerifyLocks.length && postVerifyLocks[i] != 0; i++) {
            if (Market.load(postVerifyLocks[i]).isCapacityLocked()) {
                revert CapacityLocked(postVerifyLocks[i]);
            }
        }

        emit PoolConfigurationSet(poolId, newMarketConfigurations, msg.sender);
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

        SystemPoolConfiguration.load().minLiquidityRatioD18 = minLiquidityRatio;
    }

    function getMinLiquidityRatio() external view override returns (uint) {
        return SystemPoolConfiguration.load().minLiquidityRatioD18;
    }

    function _verifyPoolConfigurationChange(
        Pool.Data storage pool,
        MarketConfiguration.Data[] memory newMarketConfigurations
    ) internal view returns (uint128[] memory postVerifyLocks, uint128[] memory removedMarkets) {
        uint oldIdx = 0;
        uint postVerifyLocksIdx = 0;
        uint removedMarketsIdx = 0;
        uint128 lastMarketId = 0;

        postVerifyLocks = new uint128[](pool.marketConfigurations.length);
        removedMarkets = new uint128[](pool.marketConfigurations.length);

        // first we need the total weight of the new distribution
        uint totalWeight = 0;
        for (uint i = 0; i < newMarketConfigurations.length; i++) {
            totalWeight += newMarketConfigurations[i].weightD18;
        }

        for (uint i = 0; i < newMarketConfigurations.length; i++) {
            if (newMarketConfigurations[i].marketId <= lastMarketId) {
                revert ParameterError.InvalidParameter("markets", "must be supplied in strictly ascending order");
            }
            lastMarketId = newMarketConfigurations[i].marketId;

            if (newMarketConfigurations[i].weightD18 == 0) {
                revert ParameterError.InvalidParameter("weights", "weight must be non-zero");
            }

            while (
                oldIdx < pool.marketConfigurations.length &&
                pool.marketConfigurations[oldIdx].marketId < newMarketConfigurations[i].marketId
            ) {
                // market has been removed

                // need to verify market is not capacity locked
                postVerifyLocks[postVerifyLocksIdx++] = pool.marketConfigurations[oldIdx].marketId;
                removedMarkets[removedMarketsIdx++] = postVerifyLocks[postVerifyLocksIdx - 1];

                oldIdx++;
            }

            if (
                oldIdx < pool.marketConfigurations.length &&
                pool.marketConfigurations[oldIdx].marketId == newMarketConfigurations[i].marketId
            ) {
                // market has been updated

                // any divestment requires verify of capacity lock
                // upscale to precise int to make sure we have comparable precision in case of very small values
                if (
                    newMarketConfigurations[i].maxDebtShareValueD18 <
                    pool.marketConfigurations[oldIdx].maxDebtShareValueD18 ||
                    uint(newMarketConfigurations[i].weightD18).upscale(DecimalMath.PRECISION_FACTOR).divDecimal(
                        totalWeight
                    ) <
                    uint(pool.marketConfigurations[oldIdx].weightD18).upscale(DecimalMath.PRECISION_FACTOR).divDecimal(
                        pool.totalWeightsD18
                    )
                ) {
                    postVerifyLocks[postVerifyLocksIdx++] = newMarketConfigurations[i].marketId;
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
            removedMarkets[removedMarketsIdx++] = pool.marketConfigurations[oldIdx].marketId;
            oldIdx++;
        }
    }
}
