//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

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

        if (requestedPoolId >= type(uint128).max / 2) {
            revert InvalidPoolId(requestedPoolId);
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
    function rebalancePool(uint128 poolId, address optionalCollateralType) external override {
        Pool.Data storage pool = Pool.loadExisting(poolId);
        pool.distributeDebtToVaults(optionalCollateralType);

        if (optionalCollateralType != address(0)) {
            pool.recalculateVaultCollateral(optionalCollateralType);
        } else {
            pool.rebalanceMarketsInPool();
        }
    }

    /**
     * @inheritdoc IPoolModule
     */
    function setPoolConfiguration(
        uint128 poolId,
        MarketConfiguration.Data[] memory newMarketConfigurations
    ) external override {
        Pool.Data storage pool = Pool.loadExisting(poolId);
        Pool.onlyPoolOwner(poolId, msg.sender);
        pool.requireMinDelegationTimeElapsed(pool.lastConfigurationTime);

        // Update each market's pro-rata liquidity and collect accumulated debt into the pool's debt distribution.
        // Note: This follows the same pattern as Pool.recalculateVaultCollateral(),
        // where we need to distribute the debt, adjust the market configurations and distribute again.
        pool.distributeDebtToVaults(address(0));

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

        if (msg.sender != address(this)) {
            Pool.onlyPoolOwner(poolId, msg.sender);
        }

        // Rebalance all markets that need to be removed.
        for (i = 0; i < removedMarkets.length && removedMarkets[i] != 0; i++) {
            // Iter avoids griefing - MarketManager can call this with user specified iters and thus clean up a grieved market.
            Market.distributeDebtToPools(Market.load(removedMarkets[i]), 9999999999);
            Market.rebalancePools(removedMarkets[i], poolId, 0, 0);
        }

        pool.totalWeightsD18 = totalWeight.to128();

        // Distribute debt again because the unused credit capacity has been updated, and this information needs to be propagated immediately.
        pool.rebalanceMarketsInPool();

        pool.setMarketConfiguration(newMarketConfigurations);

        // solhint-disable-next-line numcast/safe-cast
        pool.lastConfigurationTime = uint64(block.timestamp);

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

    function getPoolLastConfigurationTime(uint128 poolId) external view override returns (uint64) {
        return Pool.loadExisting(poolId).lastConfigurationTime;
    }

    /**
     * @inheritdoc IPoolModule
     */
    function setPoolName(uint128 poolId, string memory name) external override {
        Pool.Data storage pool = Pool.loadExisting(poolId);
        Pool.onlyPoolOwner(poolId, msg.sender);

        pool.name = name;

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

        emit SetMinLiquidityRatio(minLiquidityRatio);
    }

    /**
     * @inheritdoc IPoolModule
     */
    function getMinLiquidityRatio() external view override returns (uint256) {
        return SystemPoolConfiguration.load().minLiquidityRatioD18;
    }
}
