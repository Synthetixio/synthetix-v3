//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

import "../../interfaces/IPoolModule.sol";
import "../../storage/Pool.sol";

/**
 * @title Module for the creation and management of pools.
 * @dev See IPoolModule.
 */
contract PoolModule is IPoolModule {
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using Pool for Pool.Data;
    using Market for Market.Data;

    bytes32 private constant _POOL_FEATURE_FLAG = "createPool";

    /**
     * @inheritdoc IPoolModule
     */
    function createPool(uint128 requestedPoolId, address owner) external override {
        FeatureFlag.ensureAccessToFeature(_POOL_FEATURE_FLAG);

        if (owner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        Pool.create(requestedPoolId, owner);

        emit PoolCreated(requestedPoolId, owner, msg.sender);
    }

    /**
     * @inheritdoc IPoolModule
     */
    function nominatePoolOwner(address nominatedOwner, uint128 poolId) external override {
        Pool.onlyPoolOwner(poolId, msg.sender);

        Pool.load(poolId).nominatedOwner = nominatedOwner;

        emit PoolOwnerNominated(poolId, nominatedOwner, msg.sender);
    }

    /**
     * @inheritdoc IPoolModule
     */
    function acceptPoolOwnership(uint128 poolId) external override {
        Pool.Data storage pool = Pool.load(poolId);

        if (pool.nominatedOwner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        pool.owner = msg.sender;
        pool.nominatedOwner = address(0);

        emit PoolOwnershipAccepted(poolId, msg.sender);
    }

    /**
     * @inheritdoc IPoolModule
     */
    function revokePoolNomination(uint128 poolId) external override {
        Pool.onlyPoolOwner(poolId, msg.sender);

        Pool.load(poolId).nominatedOwner = address(0);

        emit PoolNominationRevoked(poolId, msg.sender);
    }

    /**
     * @inheritdoc IPoolModule
     */
    function renouncePoolNomination(uint128 poolId) external override {
        Pool.Data storage pool = Pool.load(poolId);

        if (pool.nominatedOwner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        pool.nominatedOwner = address(0);

        emit PoolNominationRenounced(poolId, msg.sender);
    }

    /**
     * @inheritdoc IPoolModule
     */
    function getPoolOwner(uint128 poolId) external view override returns (address) {
        return Pool.load(poolId).owner;
    }

    /**
     * @inheritdoc IPoolModule
     */
    function getNominatedPoolOwner(uint128 poolId) external view override returns (address) {
        return Pool.load(poolId).nominatedOwner;
    }

    /**
     * @inheritdoc IPoolModule
     */
    function setPoolConfiguration(
        uint128 poolId,
        MarketConfiguration.Data[] memory newMarketConfigurations
    ) external override {
        Pool.requireExists(poolId);
        Pool.onlyPoolOwner(poolId, msg.sender);

        Pool.Data storage pool = Pool.load(poolId);

        // Update each market's pro-rata liquidity and collect accumulated debt into the pool's debt distribution.
        // Note: This follows the same pattern as Pool.recalculateVaultCollateral(),
        // where we need to distribute the debt, adjust the market configurations and distribute again.
        pool.distributeDebtToVaults();

        // Identify markets that need to be removed or verified later for being locked.
        (
            uint128[] memory potentiallyLockedMarkets,
            uint128[] memory removedMarkets
        ) = _analyzePoolConfigurationChange(pool, newMarketConfigurations);

        // Replace existing market configurations with the new ones.
        // (May leave old configurations at the end of the array if the new array is shorter).
        uint256 i = 0;
        uint256 totalWeight = 0;
        // Iterate up to the shorter length.
        uint256 len = newMarketConfigurations.length < pool.marketConfigurations.length
            ? newMarketConfigurations.length
            : pool.marketConfigurations.length;
        for (; i < len; i++) {
            pool.marketConfigurations[i] = newMarketConfigurations[i];
            totalWeight += newMarketConfigurations[i].weightD18;
        }

        // If the old array was shorter, push the new elements in.
        for (; i < newMarketConfigurations.length; i++) {
            pool.marketConfigurations.push(newMarketConfigurations[i]);
            totalWeight += newMarketConfigurations[i].weightD18;
        }

        // If the old array was longer, truncate it.
        uint256 popped = pool.marketConfigurations.length - i;
        for (i = 0; i < popped; i++) {
            pool.marketConfigurations.pop();
        }

        // Rebalance all markets that need to be removed.
        for (i = 0; i < removedMarkets.length && removedMarkets[i] != 0; i++) {
            Market.rebalancePools(removedMarkets[i], poolId, 0, 0);
        }

        pool.totalWeightsD18 = totalWeight.to128();

        // Distribute debt again because the unused credit capacity has been updated, and this information needs to be propagated immediately.
        pool.distributeDebtToVaults();

        // The credit delegation proportion of the pool can only stay the same, or increase,
        // so prevent the removal of markets whose capacity is locked.
        // Note: This check is done here because it needs to happen after removed markets are rebalanced.
        for (i = 0; i < potentiallyLockedMarkets.length && potentiallyLockedMarkets[i] != 0; i++) {
            if (Market.load(potentiallyLockedMarkets[i]).isCapacityLocked()) {
                revert CapacityLocked(potentiallyLockedMarkets[i]);
            }
        }

        emit PoolConfigurationSet(poolId, newMarketConfigurations, msg.sender);
    }

    /**
     * @inheritdoc IPoolModule
     */
    function getPoolConfiguration(
        uint128 poolId
    ) external view override returns (MarketConfiguration.Data[] memory) {
        Pool.Data storage pool = Pool.load(poolId);

        MarketConfiguration.Data[] memory marketConfigurations = new MarketConfiguration.Data[](
            pool.marketConfigurations.length
        );

        for (uint256 i = 0; i < pool.marketConfigurations.length; i++) {
            marketConfigurations[i] = pool.marketConfigurations[i];
        }

        return marketConfigurations;
    }

    /**
     * @inheritdoc IPoolModule
     */
    function setPoolName(uint128 poolId, string memory name) external override {
        Pool.requireExists(poolId);
        Pool.onlyPoolOwner(poolId, msg.sender);

        Pool.load(poolId).name = name;

        emit PoolNameUpdated(poolId, name, msg.sender);
    }

    /**
     * @inheritdoc IPoolModule
     */
    function getPoolName(uint128 poolId) external view override returns (string memory poolName) {
        return Pool.load(poolId).name;
    }

    /**
     * @inheritdoc IPoolModule
     */
    function setMinLiquidityRatio(uint256 minLiquidityRatio) external override {
        OwnableStorage.onlyOwner();

        SystemPoolConfiguration.load().minLiquidityRatioD18 = minLiquidityRatio;
    }

    /**
     * @inheritdoc IPoolModule
     */
    function getMinLiquidityRatio() external view override returns (uint256) {
        return SystemPoolConfiguration.load().minLiquidityRatioD18;
    }

    /**
     * @dev Compares a new pool configuration with the existing one,
     * and returns information about markets that need to be removed, or whose capacity might be locked.
     *
     * Note: Stack too deep errors prevent the use of local variables to improve code readability here.
     */
    function _analyzePoolConfigurationChange(
        Pool.Data storage pool,
        MarketConfiguration.Data[] memory newMarketConfigurations
    )
        internal
        view
        returns (uint128[] memory potentiallyLockedMarkets, uint128[] memory removedMarkets)
    {
        uint256 oldIdx = 0;
        uint256 potentiallyLockedMarketsIdx = 0;
        uint256 removedMarketsIdx = 0;
        uint128 lastMarketId = 0;

        potentiallyLockedMarkets = new uint128[](pool.marketConfigurations.length);
        removedMarkets = new uint128[](pool.marketConfigurations.length);

        // First we need the total weight of the new distribution.
        uint256 totalWeightD18 = 0;
        for (uint256 i = 0; i < newMarketConfigurations.length; i++) {
            totalWeightD18 += newMarketConfigurations[i].weightD18;
        }

        // Now, iterate through the incoming market configurations, and compare with them with the existing ones.
        for (uint256 newIdx = 0; newIdx < newMarketConfigurations.length; newIdx++) {
            // Reject duplicate market ids,
            // AND ensure that they are provided in ascending order.
            if (newMarketConfigurations[newIdx].marketId <= lastMarketId) {
                revert ParameterError.InvalidParameter(
                    "markets",
                    "must be supplied in strictly ascending order"
                );
            }
            lastMarketId = newMarketConfigurations[newIdx].marketId;

            // Reject markets with no weight.
            if (newMarketConfigurations[newIdx].weightD18 == 0) {
                revert ParameterError.InvalidParameter("weights", "weight must be non-zero");
            }

            // Note: The following blocks of code compare the incoming market (at newIdx) to an existing market (at oldIdx).
            // newIdx increases once per iteration in the for loop, but oldIdx may increase multiple times if certain conditions are met.

            // If the market id of newIdx is greater than any of the old market ids,
            // consider all the old ones removed and mark them for post verification (increases oldIdx for each).
            while (
                oldIdx < pool.marketConfigurations.length &&
                pool.marketConfigurations[oldIdx].marketId <
                newMarketConfigurations[newIdx].marketId
            ) {
                potentiallyLockedMarkets[potentiallyLockedMarketsIdx++] = pool
                    .marketConfigurations[oldIdx]
                    .marketId;
                removedMarkets[removedMarketsIdx++] = potentiallyLockedMarkets[
                    potentiallyLockedMarketsIdx - 1
                ];

                oldIdx++;
            }

            // If the market id of newIdx is equal to any of the old market ids,
            // consider it updated (increases oldIdx once).
            if (
                oldIdx < pool.marketConfigurations.length &&
                pool.marketConfigurations[oldIdx].marketId ==
                newMarketConfigurations[newIdx].marketId
            ) {
                // Get weight ratios for comparison below.
                // Upscale them to make sure that we have compatible precision in case of very small values.
                // If the market's new maximum share value or weight ratio decreased,
                // mark it for later verification.
                if (
                    newMarketConfigurations[newIdx].maxDebtShareValueD18 <
                    pool.marketConfigurations[oldIdx].maxDebtShareValueD18 ||
                    newMarketConfigurations[newIdx]
                        .weightD18
                        .to256()
                        .upscale(DecimalMath.PRECISION_FACTOR)
                        .divDecimal(totalWeightD18) < // newWeightRatioD27
                    pool
                        .marketConfigurations[oldIdx]
                        .weightD18
                        .to256()
                        .upscale(DecimalMath.PRECISION_FACTOR)
                        .divDecimal(pool.totalWeightsD18) // oldWeightRatioD27
                ) {
                    potentiallyLockedMarkets[
                        potentiallyLockedMarketsIdx++
                    ] = newMarketConfigurations[newIdx].marketId;
                }

                oldIdx++;
            }

            // Note: processing or checks for added markets is not necessary.
        } // for end

        // If any of the old markets was not processed up to this point,
        // it means that it is not present in the new array, so mark it for removal.
        while (oldIdx < pool.marketConfigurations.length) {
            removedMarkets[removedMarketsIdx++] = pool.marketConfigurations[oldIdx].marketId;
            oldIdx++;
        }
    }
}
