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

/**
 * @title System module for the creation and management of pools.
 *
 * The pool owner can be specified during creation, can be transferred, and provides credentials for configuring the pool.
 */
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

    /**
     * @dev Creates a pool with the requested pool id.
     */
    function createPool(uint128 requestedPoolId, address owner) external override {
        FeatureFlag.ensureAccessToFeature(_POOL_FEATURE_FLAG);

        if (owner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        Pool.create(requestedPoolId, owner);

        emit PoolCreated(requestedPoolId, owner);
    }

    /**
     * @dev Allows the current pool owner to nominate a new owner.
     */
    function nominatePoolOwner(address nominatedOwner, uint128 poolId) external override {
        Pool.onlyPoolOwner(poolId, msg.sender);

        Pool.load(poolId).nominatedOwner = nominatedOwner;

        emit NominatedPoolOwner(poolId, nominatedOwner);
    }

    /**
     * @dev After a new pool owner has been nominated, allows it to accept the nomination and thus ownership of the pool.
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
     * @dev After a new pool owner has been nominated, allows it to reject the nomination.
     */
    function revokePoolNomination(uint128 poolId) external override {
        Pool.onlyPoolOwner(poolId, msg.sender);

        Pool.load(poolId).nominatedOwner = address(0);

        emit PoolNominationRevoked(poolId, msg.sender);
    }

    /**
     * @dev Allows the current owner to renounce ownership.
     *
     * Warning: This effectively leaves the pool owner-less.
     * TODO: Are we sure we want this?
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
     * @dev Returns the current pool owner.
     */
    function getPoolOwner(uint128 poolId) external view override returns (address) {
        return Pool.load(poolId).owner;
    }

    /**
     * @dev Returns the current nominated pool owner.
     */
    function getNominatedPoolOwner(uint128 poolId) external view override returns (address) {
        return Pool.load(poolId).nominatedOwner;
    }

    /**
     * @dev Allows the pool owner to configure the pool.
     *
     * The pool's configuration is composed of an array of MarketConfiguration objects,
     * which describe which markets the pool provides liquidity to, in what proportion, and to what extent.
     */
    function setPoolConfiguration(uint128 poolId, MarketConfiguration.Data[] memory newMarketConfigurations)
        external
        override
    {
        Pool.requireExists(poolId);
        Pool.onlyPoolOwner(poolId, msg.sender);

        Pool.Data storage pool = Pool.load(poolId);

        // Update each market's pro-rata liquidity and collect accumulated debt into the pool's debt distribution.
        // Note: This follows the same pattern as Pool.recalculateVaultCollateral(),
        // where we need to distribute the debt, adjust the market configurations and distribute again.
        pool.distributeDebtToVaults();

        // Identify markets that need to be removed or verified later for being locked.
        (uint128[] memory potentiallyLockedMarkets, uint128[] memory removedMarkets) = _analyzePoolConfigurationChange(
            pool,
            newMarketConfigurations
        );

        // Replace existing market configurations with new ones.
        // (May leave old configurations at the end of the array if the new array is shorter).
        uint i = 0;
        uint totalWeight = 0;
        // Iterate up to the shorter array's length.
        uint len = newMarketConfigurations.length < pool.marketConfigurations.length
            ? newMarketConfigurations.length
            : pool.marketConfigurations.length;
        for (; i < len; i++) {
            pool.marketConfigurations[i] = newMarketConfigurations[i];
            totalWeight += newMarketConfigurations[i].weightD18;
        }

        // If the new array was shorter, push the new elements in.
        for (; i < newMarketConfigurations.length; i++) {
            pool.marketConfigurations.push(newMarketConfigurations[i]);
            totalWeight += newMarketConfigurations[i].weightD18;
        }

        // If the new array was longer, truncate the one in storage.
        uint popped = pool.marketConfigurations.length - i;
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

        // Prevent the removal of markets whose capacity is locked.
        // TODO: Why?
        for (i = 0; i < potentiallyLockedMarkets.length && potentiallyLockedMarkets[i] != 0; i++) {
            if (Market.load(potentiallyLockedMarkets[i]).isCapacityLocked()) {
                revert CapacityLocked(potentiallyLockedMarkets[i]);
            }
        }

        emit PoolConfigurationSet(poolId, newMarketConfigurations, msg.sender);
    }

    /**
     * @dev Retrieves the MarketConfiguration of the specified pool.
     */
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

    /**
     * @dev Allows the owner of the pool to set the pool's name.
     */
    function setPoolName(uint128 poolId, string memory name) external override {
        Pool.requireExists(poolId);
        Pool.onlyPoolOwner(poolId, msg.sender);

        Pool.load(poolId).name = name;

        emit PoolNameUpdated(poolId, name, msg.sender);
    }

    /**
     * @dev Returns the pool's name.
     */
    function getPoolName(uint128 poolId) external view override returns (string memory poolName) {
        return Pool.load(poolId).name;
    }

    /**
     * @dev Allows the system owner (not the pool owner) to set the system-wide minimum liquidity ratio.
     */
    function setMinLiquidityRatio(uint minLiquidityRatio) external override {
        OwnableStorage.onlyOwner();

        SystemPoolConfiguration.load().minLiquidityRatioD18 = minLiquidityRatio;
    }

    /**
     * @dev Retrieves the system-wide minimum liquidity ratio.
     */
    function getMinLiquidityRatio() external view override returns (uint) {
        return SystemPoolConfiguration.load().minLiquidityRatioD18;
    }

    /**
     * @dev Compares a new pool configuration with the existing one,
     * and returns information about markets that need to be removed, or whose capacity might be locked.
     */
    function _analyzePoolConfigurationChange(
        Pool.Data storage pool,
        MarketConfiguration.Data[] memory newMarketConfigurations
    ) internal view returns (uint128[] memory potentiallyLockedMarkets, uint128[] memory removedMarkets) {
        uint oldIdx = 0;
        uint potentiallyLockedMarketsIdx = 0;
        uint removedMarketsIdx = 0;
        uint128 lastMarketId = 0;

        potentiallyLockedMarkets = new uint128[](pool.marketConfigurations.length);
        removedMarkets = new uint128[](pool.marketConfigurations.length);

        // First we need the total weight of the new distribution.
        uint totalWeightD18 = 0;
        for (uint i = 0; i < newMarketConfigurations.length; i++) {
            totalWeightD18 += newMarketConfigurations[i].weightD18;
        }

        // Now, iterate through the incoming market configurations and compare with them with the existing configurations.
        for (uint newIdx = 0; newIdx < newMarketConfigurations.length; newIdx++) {
            // Reject duplicate market ids, AND ensure they are provided in ascending order.
            if (newMarketConfigurations[newIdx].marketId <= lastMarketId) {
                revert ParameterError.InvalidParameter("markets", "must be supplied in strictly ascending order");
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
                pool.marketConfigurations[oldIdx].marketId < newMarketConfigurations[newIdx].marketId
            ) {
                potentiallyLockedMarkets[potentiallyLockedMarketsIdx++] = pool.marketConfigurations[oldIdx].marketId;
                removedMarkets[removedMarketsIdx++] = potentiallyLockedMarkets[potentiallyLockedMarketsIdx - 1];

                oldIdx++;
            }

            // If the market id of newIdx is equal to any of the old market ids,
            // consider it updated (increases oldIdx once).
            if (
                oldIdx < pool.marketConfigurations.length &&
                pool.marketConfigurations[oldIdx].marketId == newMarketConfigurations[newIdx].marketId
            ) {
                // Get weight ratios for comparison below.
                // Upscale them to make sure we have compatible precision in case of very small values.
                uint newWeightRatioD27 = uint(newMarketConfigurations[newIdx].weightD18)
                    .upscale(DecimalMath.PRECISION_FACTOR)
                    .divDecimal(totalWeightD18);
                uint oldWeightRatioD27 = uint(pool.marketConfigurations[oldIdx].weightD18)
                    .upscale(DecimalMath.PRECISION_FACTOR)
                    .divDecimal(pool.totalWeightsD18);

                // If the market's new maximum share value decreased, or its weight decreased compared to the total weights,
                // mark it for post verification.
                if (
                    newMarketConfigurations[newIdx].maxDebtShareValueD18 <
                    pool.marketConfigurations[oldIdx].maxDebtShareValueD18 ||
                    newWeightRatioD27 < oldWeightRatioD27
                ) {
                    potentiallyLockedMarkets[potentiallyLockedMarketsIdx++] = newMarketConfigurations[newIdx].marketId;
                }

                oldIdx++;
            }

            // Note: processing or checks for new markets is not necessary.
        } // for end

        // If any of the old markets was not processed, it means at this point
        // that it is not present in the new array, so mark it for removal.
        while (oldIdx < pool.marketConfigurations.length) {
            // market has been removed
            removedMarkets[removedMarketsIdx++] = pool.marketConfigurations[oldIdx].marketId;
            oldIdx++;
        }
    }
}
