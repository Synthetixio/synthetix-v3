//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./Config.sol";
import "./Distribution.sol";
import "./MarketConfiguration.sol";
import "./Vault.sol";
import "./Market.sol";
import "./PoolCrossChainInfo.sol";
import "./SystemPoolConfiguration.sol";

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @title Aggregates collateral from multiple users in order to provide liquidity to a configurable set of markets.
 *
 * The set of markets is configured as an array of MarketConfiguration objects, where the weight of the market can be specified. This weight, and the aggregated total weight of all the configured markets, determines how much collateral from the pool each market has, as well as in what proportion the market passes on debt to the pool and thus to all its users.
 *
 * The pool tracks the collateral provided by users using an array of Vaults objects, for which there will be one per collateral type. Each vault tracks how much collateral each user has delegated to this pool, how much debt the user has because of minting USD, as well as how much corresponding debt the pool has passed on to the user.
 */
library Pool {
    using CollateralConfiguration for CollateralConfiguration.Data;
    using Market for Market.Data;
    using Vault for Vault.Data;
    using Distribution for Distribution.Data;
    using DecimalMath for uint256;
    using DecimalMath for int256;
    using DecimalMath for int128;
    using SetUtil for SetUtil.AddressSet;
    using SafeCastAddress for address;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;

    /**
     * @dev Thrown when the specified pool is not found.
     */
    error PoolNotFound(uint128 poolId);

    /**
     * @dev Thrown when attempting to create a pool that already exists.
     */
    error PoolAlreadyExists(uint128 poolId);

    /**
     * @dev Thrown when trying to create a cross chain pool from a non-primary pool (aka a pool that wasn't itself created by another pool)
     */
    error PoolIsNotPrimary(uint128 poolId);

    /**
     * @dev Thrown when min delegation time for a market connected to the pool has not elapsed
     */
    error MinDelegationTimeoutPending(uint128 poolId, uint32 timeRemaining);

    /**
     * @notice Thrown when attempting to disconnect a market whose capacity is locked, and whose removal would cause a decrease in its associated pool's credit delegation proportion.
     */
    error CapacityLocked(uint256 marketId);

    bytes32 private constant _CONFIG_SET_MARKET_MIN_DELEGATE_MAX = "setMarketMinDelegateTime_max";

    struct Data {
        /**
         * @dev Numeric identifier for the pool. Must be unique.
         * @dev A pool with id zero exists! (See Pool.loadExisting()). Users can delegate to this pool to be able to mint USD without being exposed to fluctuating debt.
         */
        uint128 id;
        /**
         * @dev Text identifier for the pool.
         *
         * Not required to be unique.
         */
        string name;
        /**
         * @dev Creator of the pool, which has configuration access rights for the pool.
         *
         * See onlyPoolOwner.
         */
        address owner;
        /**
         * @dev Allows the current pool owner to nominate a new owner, and thus transfer pool configuration credentials.
         */
        address nominatedOwner;
        /**
         * @dev Sum of all market weights.
         *
         * Market weights are tracked in `MarketConfiguration.weight`, one for each market. The ratio of each market's `weight` to the pool's `totalWeights` determines the pro-rata share of the market to the pool's total liquidity.
         *
         * Reciprocally, this pro-rata share also determines how much the pool is exposed to each market's debt.
         */
        uint128 totalWeightsD18;
        /**
         * @dev Accumulated cache value of all vault collateral debts
         */
        int128 totalVaultDebtsD18;
        /**
         * @dev Array of markets connected to this pool, and their configurations. I.e. weight, etc.
         *
         * See totalWeights.
         */
        MarketConfiguration.Data[] marketConfigurations;
        /**
         * @dev A pool's debt distribution connects pools to the debt distribution chain, i.e. vaults and markets. Vaults are actors in the pool's debt distribution, where the amount of shares they possess depends on the amount of collateral each vault delegates to the pool.
         *
         * The debt distribution chain will move debt from markets into this pools, and then from pools to vaults.
         *
         * Actors: Vaults.
         * Shares: USD value, proportional to the amount of collateral that the vault delegates to the pool.
         * Value per share: Debt per dollar of collateral. Depends on aggregated debt of connected markets.
         *
         */
        Distribution.Data vaultsDebtDistribution;
        /**
         * @dev Reference to all the vaults that provide liquidity to this pool.
         *
         * Each collateral type will have its own vault, specific to this pool. I.e. if two pools both use SNX collateral, each will have its own SNX vault.
         *
         * Vaults track user collateral and debt using a debt distribution, which is connected to the debt distribution chain.
         */
        mapping(address => Vault.Data) vaults;
        uint64 lastConfigurationTime;
        uint64 __reserved1;
        uint64 __reserved2;
        uint64 __reserved3;
        uint128 totalCapacityD18;
        int128 cumulativeDebtD18;
        mapping(uint256 => uint256) heldMarketConfigurationWeights;
        mapping(uint256 => PoolCrossChainInfo.Data) crossChain;
    }

    /**
     * @dev Returns the pool stored at the specified pool id.
     */
    function load(uint128 id) internal pure returns (Data storage pool) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.Pool", id));
        assembly {
            pool.slot := s
        }
    }

    /**
     * @dev Creates a pool for the given pool id, and assigns the caller as its owner.
     *
     * Reverts if the specified pool already exists.
     */
    function create(uint128 id, address owner) internal returns (Pool.Data storage pool) {
        if (id == 0 || load(id).id == id) {
            revert PoolAlreadyExists(id);
        }

        pool = load(id);

        pool.id = id;
        pool.owner = owner;
    }

    function isCrossChainEnabled(Data storage self) internal view returns (bool) {
        return self.crossChain[0].pairedChains.length > 0;
    }

    function getCreditCapacity(Data storage self) internal view returns (uint256) {
        return
            isCrossChainEnabled(self)
                ? self.crossChain[0].latestSync.liquidity
                : self.totalCapacityD18;
    }

    function getTotalDebts(Data storage self) internal view returns (int256) {
        return
            isCrossChainEnabled(self)
                ? self.crossChain[0].latestSync.totalDebt
                : self.totalVaultDebtsD18;
    }

    function getTotalWeight(Data storage self) internal view returns (uint256) {
        return
            isCrossChainEnabled(self)
                ? self.crossChain[0].latestTotalWeights
                : self.totalWeightsD18;
    }

    function getOldestSync(Data storage self) internal view returns (uint64) {
        return
            isCrossChainEnabled(self)
                ? self.crossChain[0].latestSync.oldestDataTimestamp
                : uint64(block.timestamp);
    }

    function rebalanceMarketsInPool(
        Data storage self
    ) internal returns (int256 cumulativeDebtChangeD18, int256 cumulativeDebtD18) {
        uint256 totalWeightsD18 = getTotalWeight(self);

        if (totalWeightsD18 == 0) {
            return (0, 0); // Nothing to rebalance.
        }

        // Read from storage once, before entering the loop below.
        // These values should not change while iterating through each market.
        uint256 totalCreditCapacityD18 = getCreditCapacity(self);
        int128 debtPerShareD18 = totalCreditCapacityD18 > 0 // solhint-disable-next-line numcast/safe-cast
            ? getTotalDebts(self).divDecimal(totalCreditCapacityD18.toInt()).to128() // solhint-disable-next-line numcast/safe-cast
            : int128(0);

        //uint256 systemMinLiquidityRatioD18 = ;

        // Loop through the pool's markets, applying market weights, and tracking how this changes the amount of debt that this pool is responsible for.
        // This debt extracted from markets is then applied to the pool's vault debt distribution, which thus exposes debt to the pool's vaults.
        for (uint256 i = 0; i < self.marketConfigurations.length; i++) {
            MarketConfiguration.Data storage marketConfiguration = self.marketConfigurations[i];

            uint256 weightD18 = marketConfiguration.weightD18;

            // Calculate each market's pro-rata USD liquidity.
            // Note: the factor `(weight / totalWeights)` is not deduped in the operations below to maintain numeric precision.

            uint256 marketCreditCapacityD18 = (totalCreditCapacityD18 * weightD18) /
                totalWeightsD18;

            // do we have a delayed weight application for cross chain?
            if (
                isCrossChainEnabled(self) &&
                self.crossChain[0].latestSync.oldestPoolConfigTimestamp < self.lastConfigurationTime
            ) {
                uint256 heldWeight = self.heldMarketConfigurationWeights[
                    marketConfiguration.marketId
                ];
                marketCreditCapacityD18 = totalCreditCapacityD18.mulDecimal(
                    heldWeight == 1 ? 0 : heldWeight
                );
            }

            Market.Data storage marketData = Market.load(marketConfiguration.marketId);

            // Use market-specific minimum liquidity ratio if set, otherwise use system default.
            uint256 minLiquidityRatioD18 = marketData.minLiquidityRatioD18 > 0
                ? marketData.minLiquidityRatioD18
                : SystemPoolConfiguration.load().minLiquidityRatioD18;

            // Contain the pool imposed market's maximum debt share value.
            // Imposed by system.
            int256 effectiveMaxShareValueD18 = getSystemMaxValuePerShare(
                marketData.id,
                minLiquidityRatioD18,
                debtPerShareD18
            );
            // Imposed by pool.
            int256 configuredMaxShareValueD18 = marketConfiguration.maxDebtShareValueD18;
            effectiveMaxShareValueD18 = effectiveMaxShareValueD18 < configuredMaxShareValueD18
                ? effectiveMaxShareValueD18
                : configuredMaxShareValueD18;

            // Update each market's corresponding credit capacity.
            // The returned value represents how much the market's debt changed after changing the shares of this pool actor, which is aggregated to later be passed on the pools debt distribution.
            cumulativeDebtChangeD18 += Market.rebalancePools(
                marketConfiguration.marketId,
                self.id,
                effectiveMaxShareValueD18,
                marketCreditCapacityD18
            );
        }

        cumulativeDebtD18 = self.cumulativeDebtD18;
        // TODO: should this be removed from the rebalancePool? if the caller does not perform potentially necessary actions after
        // this, it could cause accumulated debt to go out of sync with downstream accounts
        self.cumulativeDebtD18 = (cumulativeDebtD18 + cumulativeDebtChangeD18).to128();
    }

    /**
     * @dev Ticker function that updates the debt distribution chain downwards, from markets into the pool, according to each market's weight.
     *
     * It updates the chain by performing these actions:
     * - Splits the pool's total liquidity of the pool into each market, pro-rata. The amount of shares that the pool has on each market depends on how much liquidity the pool provides to the market.
     * - Accumulates the change in debt value from each market into the pools own vault debt distribution's value per share.
     */
    function distributeDebtToVaults(Data storage self, int256 debtAmount) internal {
        // Passes on the accumulated debt changes from the markets, into the pool, so that vaults can later access this debt.
        self.vaultsDebtDistribution.distributeValue(debtAmount);
    }

    /**
     * @dev Determines the resulting maximum value per share for a market, according to a system-wide minimum liquidity ratio. This prevents markets from assigning more debt to pools than they have collateral to cover.
     *
     * Note: There is a market-wide fail safe for each market at `MarketConfiguration.maxDebtShareValue`. The lower of the two values should be used.
     *
     * See `SystemPoolConfiguration.minLiquidityRatio`.
     */
    function getSystemMaxValuePerShare(
        uint128 marketId,
        uint256 minLiquidityRatioD18,
        int256 debtPerShareD18
    ) internal view returns (int256) {
        // Retrieve the current value per share of the market.
        Market.Data storage marketData = Market.load(marketId);
        int256 valuePerShareD18 = marketData.poolsDebtDistribution.getValuePerShare();

        // Calculate the margin of debt that the market would incur if it hit the system wide limit.
        uint256 marginD18 = minLiquidityRatioD18 == 0
            ? DecimalMath.UNIT
            : DecimalMath.UNIT.divDecimal(minLiquidityRatioD18);

        // The resulting maximum value per share is the distribution's value per share,
        // plus the margin to hit the limit, minus the current debt per share.
        return valuePerShareD18 + marginD18.toInt() - debtPerShareD18;
    }

    /**
     * @dev Reverts if the pool does not exist with appropriate error. Otherwise, returns the pool.
     */
    function loadExisting(uint128 id) internal view returns (Data storage) {
        Data storage p = load(id);
        if (id != 0 && p.id != id) {
            revert PoolNotFound(id);
        }

        return p;
    }

    /**
     * @dev Returns true if the pool is exposed to the specified market.
     */
    function hasMarket(Data storage self, uint128 marketId) internal view returns (bool) {
        for (uint256 i = 0; i < self.marketConfigurations.length; i++) {
            if (self.marketConfigurations[i].marketId == marketId) {
                return true;
            }
        }

        return false;
    }

    function recalculateAllCollaterals(Data storage self) internal {
        SetUtil.AddressSet storage availableCollaterals = CollateralConfiguration
            .loadAvailableCollaterals();

        int256 deltaDebtD18;

        for (uint i = 0; i < availableCollaterals.length(); i++) {
            address collateralType = availableCollaterals.valueAt(i);

            // Transfer the debt change from the pool into the vault.
            bytes32 actorId = collateralType.toBytes32();
            self.vaults[collateralType].distributeDebtToAccounts(
                self.vaultsDebtDistribution.accumulateActor(actorId)
            );

            // Get the latest collateral price.
            uint256 collateralPriceD18 = CollateralConfiguration
                .load(collateralType)
                .getCollateralPrice();

            // Changes in price update the corresponding vault's total collateral value as well as its liquidity (collateral - debt).
            (
                uint256 usdWeightD18,
                ,
                int256 deltaCapacityD18,
                ,
                int256 collateralDeltaDebtD18
            ) = self.vaults[collateralType].updateCreditCapacity(collateralPriceD18);

            // Update the vault's shares in the pool's debt distribution, according to the value of its collateral.
            self.vaultsDebtDistribution.setActorShares(actorId, usdWeightD18);

            self.totalCapacityD18 = (self.totalCapacityD18.toInt() + deltaCapacityD18)
                .toUint()
                .to128();

            // Accumulate the change in total liquidity, from the vault, into the pool.
            deltaDebtD18 += collateralDeltaDebtD18;
        }

        // Accumulate the change in total liquidity, from the vault, into the pool.
        self.totalVaultDebtsD18 = self.totalVaultDebtsD18 + deltaDebtD18.to128();

        // Distribute debt again because the market credit capacity may have changed, so we should ensure the vaults have the most up to date capacities
        rebalanceMarketsInPool(self);
    }

    /**
     * @dev Ticker function that updates the debt distribution chain for a specific collateral type downwards, from the pool into the corresponding the vault, according to changes in the collateral's price.
     *
     * It updates the chain by performing these actions:
     * - Collects the latest price of the corresponding collateral and updates the vault's liquidity.
     * - Updates the vaults shares in the pool's debt distribution, according to the collateral provided by the vault.
     * - Updates the value per share of the vault's debt distribution.
     */
    function recalculateVaultCollateral(
        Data storage self,
        address collateralType
    ) internal returns (uint256 collateralPriceD18) {
        if (!isCrossChainEnabled(self)) {
            (int256 cumulativeDebtChange, ) = rebalanceMarketsInPool(self);

            distributeDebtToVaults(self, cumulativeDebtChange);
        }

        // Transfer the debt change from the pool into the vault.
        bytes32 actorId = collateralType.toBytes32();
        self.vaults[collateralType].distributeDebtToAccounts(
            self.vaultsDebtDistribution.accumulateActor(actorId)
        );

        // Get the latest collateral price.
        collateralPriceD18 = CollateralConfiguration.load(collateralType).getCollateralPrice();

        // Changes in price update the corresponding vault's total collateral value as well as its liquidity (collateral - debt).
        (uint256 usdWeightD18, , int256 deltaCapacityD18, , int256 deltaDebtD18) = self
            .vaults[collateralType]
            .updateCreditCapacity(collateralPriceD18);

        // Update the vault's shares in the pool's debt distribution, according to the value of its collateral.
        self.vaultsDebtDistribution.setActorShares(actorId, usdWeightD18);

        self.totalCapacityD18 = (self.totalCapacityD18.toInt() + deltaCapacityD18).toUint().to128();

        // Accumulate the change in total liquidity, from the vault, into the pool.
        self.totalVaultDebtsD18 = self.totalVaultDebtsD18 + deltaDebtD18.to128();

        // Distribute debt again because the market credit capacity may have changed, so we should ensure the vaults have the most up to date capacities
        rebalanceMarketsInPool(self);
    }

    /**
     * @dev Updates the debt distribution chain for this pool, and consolidates the given account's debt.
     */
    function updateAccountDebt(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal returns (int256 debtD18) {
        recalculateVaultCollateral(self, collateralType);

        return self.vaults[collateralType].consolidateAccountDebt(accountId);
    }

    /**
     * @dev Clears all vault data for the specified collateral type.
     */
    function resetVault(Data storage self, address collateralType) internal {
        // Creates a new epoch in the vault, effectively zeroing out all values.
        self.vaults[collateralType].reset();

        // Ensure that the vault's values update the debt distribution chain.
        recalculateVaultCollateral(self, collateralType);
    }

    /**
     * @dev Calculates the collateralization ratio of the vault that tracks the given collateral type.
     *
     * The c-ratio is the vault's share of the total debt of the pool, divided by the collateral it delegates to the pool.
     *
     * Note: This is not a view function. It updates the debt distribution chain before performing any calculations.
     */
    function currentVaultCollateralRatio(
        Data storage self,
        address collateralType
    ) internal returns (uint256) {
        int256 vaultDebtD18 = currentVaultDebt(self, collateralType);
        (, uint256 collateralValueD18) = currentVaultCollateral(self, collateralType);

        return vaultDebtD18 > 0 ? collateralValueD18.divDecimal(vaultDebtD18.toUint()) : 0;
    }

    /**
     * @dev Finds a connected market whose credit capacity has reached its locked limit.
     *
     * Note: Returns market zero (null market) if none is found.
     */
    function findMarketWithCapacityLocked(
        Data storage self
    ) internal view returns (Market.Data storage lockedMarket) {
        for (uint256 i = 0; i < self.marketConfigurations.length; i++) {
            Market.Data storage market = Market.load(self.marketConfigurations[i].marketId);

            if (market.isCapacityLocked()) {
                return market;
            }
        }

        // Market zero = null market.
        return Market.load(0);
    }

    function getRequiredMinDelegationTime(
        Data storage self
    ) internal view returns (uint32 requiredMinDelegateTime) {
        for (uint256 i = 0; i < self.marketConfigurations.length; i++) {
            uint32 marketMinDelegateTime = Market
                .load(self.marketConfigurations[i].marketId)
                .minDelegateTime;

            if (marketMinDelegateTime > requiredMinDelegateTime) {
                requiredMinDelegateTime = marketMinDelegateTime;
            }
        }

        // solhint-disable-next-line numcast/safe-cast
        uint32 maxMinDelegateTime = uint32(
            Config.readUint(_CONFIG_SET_MARKET_MIN_DELEGATE_MAX, 86400 * 30)
        );
        return
            maxMinDelegateTime < requiredMinDelegateTime
                ? maxMinDelegateTime
                : requiredMinDelegateTime;
    }

    function addCrossChain(Data storage self, uint64 chainId) internal returns (uint128 ccPoolId) {
        if (self.id > type(uint128).max / 2) {
            revert PoolIsNotPrimary(self.id);
        }

        if (self.crossChain[0].pairedPoolIds[chainId] != 0) {
            revert PoolAlreadyExists(self.crossChain[0].pairedPoolIds[chainId]);
        }

        ccPoolId = getCrossChainPoolId(uint64(block.chainid), self.id);

        self.crossChain[0].pairedPoolIds[chainId] = ccPoolId;
        self.crossChain[0].pairedChains.push(chainId);
    }

    function getCrossChainPoolId(
        uint64 srcChainId,
        uint128 srcPoolId
    ) internal returns (uint128 ccPoolId) {
        return
            uint128(uint256(keccak256(abi.encode("SNXV3CC", srcChainId, srcPoolId))) | (1 << 127));
    }

    function setCrossChainSyncData(
        Data storage self,
        PoolCrossChainSync.Data memory syncData
    ) internal {
        self.crossChain[0].latestSync = syncData;
    }

    /**
     * @dev Returns the debt of the vault that tracks the given collateral type.
     *
     * The vault's debt is the vault's share of the total debt of the pool, or its share of the total debt of the markets connected to the pool. The size of this share depends on how much collateral the pool provides to the pool.
     *
     * Note: This is not a view function. It updates the debt distribution chain before performing any calculations.
     */
    function currentVaultDebt(Data storage self, address collateralType) internal returns (int256) {
        recalculateVaultCollateral(self, collateralType);

        return self.vaults[collateralType].currentDebt();
    }

    /**
     * @dev Returns the total amount and value of the specified collateral delegated to this pool.
     */
    function currentVaultCollateral(
        Data storage self,
        address collateralType
    ) internal view returns (uint256 collateralAmountD18, uint256 collateralValueD18) {
        uint256 collateralPriceD18 = CollateralConfiguration
            .load(collateralType)
            .getCollateralPrice();

        collateralAmountD18 = self.vaults[collateralType].currentCollateral();
        collateralValueD18 = collateralPriceD18.mulDecimal(collateralAmountD18);
    }

    /**
     * @dev Returns the amount and value of collateral that the specified account has delegated to this pool.
     */
    function currentAccountCollateral(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal view returns (uint256 collateralAmountD18, uint256 collateralValueD18) {
        uint256 collateralPriceD18 = CollateralConfiguration
            .load(collateralType)
            .getCollateralPrice();

        collateralAmountD18 = self.vaults[collateralType].currentAccountCollateral(accountId);
        collateralValueD18 = collateralPriceD18.mulDecimal(collateralAmountD18);
    }

    /**
     * @dev Returns the specified account's collateralization ratio (collateral / debt).
     * @dev If the account's debt is negative or zero, returns an "infinite" c-ratio.
     */
    function currentAccountCollateralRatio(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal returns (uint256) {
        int256 positionDebtD18 = updateAccountDebt(self, collateralType, accountId);
        if (positionDebtD18 <= 0) {
            return type(uint256).max;
        }

        (, uint256 positionCollateralValueD18) = currentAccountCollateral(
            self,
            collateralType,
            accountId
        );

        return positionCollateralValueD18.divDecimal(positionDebtD18.toUint());
    }

    /**
     * @dev Reverts if the caller is not the owner of the specified pool.
     */
    function onlyPoolOwner(uint128 poolId, address caller) internal view {
        if (Pool.load(poolId).owner != caller) {
            revert AccessError.Unauthorized(caller);
        }
    }

    function requireMinDelegationTimeElapsed(
        Data storage self,
        uint64 lastDelegationTime
    ) internal view {
        uint32 requiredMinDelegationTime = getRequiredMinDelegationTime(self);
        if (block.timestamp < lastDelegationTime + requiredMinDelegationTime) {
            revert MinDelegationTimeoutPending(
                self.id,
                // solhint-disable-next-line numcast/safe-cast
                uint32(lastDelegationTime + requiredMinDelegationTime - block.timestamp)
            );
        }
    }

    function setDelayedMarketWeights(Data storage self, uint128[] memory delayedMarkets) internal {
        uint256 lastDelayedMarket;

        uint256 totalWeight = getTotalWeight(self);

        for (uint i = 0; i < self.marketConfigurations.length; i++) {
            uint128 marketId = self.marketConfigurations[i].marketId;

            while (delayedMarkets[lastDelayedMarket] < marketId) {
                // set it to an infitesimly small value
                self.heldMarketConfigurationWeights[marketId] = 1;
                lastDelayedMarket++;
            }

            if (delayedMarkets[lastDelayedMarket] == marketId) {
                self.heldMarketConfigurationWeights[marketId] =
                    self.marketConfigurations[i].weightD18 /
                    totalWeight;
                lastDelayedMarket++;
            } else {
                // market does not need to be held
                self.heldMarketConfigurationWeights[marketId] = 0;
            }
        }
    }

    function setMarketConfiguration(
        Data storage self,
        MarketConfiguration.Data[] memory newMarketConfigurations
    ) internal {
        // Identify markets that need to be removed or verified later for being locked.
        (
            ,
            uint128[] memory potentiallyLockedMarkets,
            uint128[] memory potentiallyDelayedMarkets,
            uint128[] memory removedMarkets
        ) = _analyzePoolConfigurationChange(self, newMarketConfigurations);

        if (isCrossChainEnabled(self)) {
            setDelayedMarketWeights(self, potentiallyDelayedMarkets);
        }

        // Replace existing market configurations with the new ones.
        // (May leave old configurations at the end of the array if the new array is shorter).
        uint256 i = 0;
        uint256 totalWeight = 0;
        // Iterate up to the shorter length.
        uint256 len = newMarketConfigurations.length < self.marketConfigurations.length
            ? newMarketConfigurations.length
            : self.marketConfigurations.length;
        for (; i < len; i++) {
            self.marketConfigurations[i] = newMarketConfigurations[i];
            totalWeight += newMarketConfigurations[i].weightD18;
        }

        // If the old array was shorter, push the new elements in.
        for (; i < newMarketConfigurations.length; i++) {
            self.marketConfigurations.push(newMarketConfigurations[i]);
            totalWeight += newMarketConfigurations[i].weightD18;
        }

        // If the old array was longer, truncate it.
        uint256 popped = self.marketConfigurations.length - i;
        for (i = 0; i < popped; i++) {
            self.marketConfigurations.pop();
        }

        // Rebalance all markets that need to be removed.
        for (i = 0; i < removedMarkets.length && removedMarkets[i] != 0; i++) {
            Market.rebalancePools(removedMarkets[i], self.id, 0, 0);
        }

        self.totalWeightsD18 = totalWeight.to128();

        // Credit capacity has been updated--rebalance pools.
        rebalanceMarketsInPool(self);

        // The credit delegation proportion of the pool can only stay the same, or increase,
        // so prevent the removal of markets whose capacity is locked.
        // Note: This check is done here because it needs to happen after removed markets are rebalanced.
        for (i = 0; i < potentiallyLockedMarkets.length && potentiallyLockedMarkets[i] != 0; i++) {
            if (Market.load(potentiallyLockedMarkets[i]).isCapacityLocked()) {
                revert CapacityLocked(potentiallyLockedMarkets[i]);
            }
        }
    }

    struct AnalyzePoolConfigRuntime {
        uint256 oldIdx;
        uint256 potentiallyLockedMarketsIdx;
        uint256 potentiallyDelayedMarketsIdx;
        uint256 removedMarketsIdx;
        uint128 lastMarketId;
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
        returns (
            uint256 totalWeightD18,
            uint128[] memory potentiallyLockedMarkets,
            uint128[] memory potentiallyDelayedMarkets,
            uint128[] memory removedMarkets
        )
    {
        AnalyzePoolConfigRuntime memory rt;

        potentiallyLockedMarkets = new uint128[](pool.marketConfigurations.length);
        potentiallyDelayedMarkets = new uint128[](pool.marketConfigurations.length);
        removedMarkets = new uint128[](pool.marketConfigurations.length);

        // First we need the current total weight
        for (uint256 i = 0; i < newMarketConfigurations.length; i++) {
            totalWeightD18 += newMarketConfigurations[i].weightD18;
        }

        if (isCrossChainEnabled(pool)) {
            // we need to consider the cross chain weight as well
            totalWeightD18 =
                pool.crossChain[0].latestTotalWeights +
                totalWeightD18 -
                pool.totalWeightsD18;
        }

        // Now, iterate through the incoming market configurations, and compare with them with the existing ones.
        for (uint256 newIdx = 0; newIdx < newMarketConfigurations.length; newIdx++) {
            // Reject duplicate market ids,
            // AND ensure that they are provided in ascending order.
            if (newMarketConfigurations[newIdx].marketId <= rt.lastMarketId) {
                revert ParameterError.InvalidParameter(
                    "markets",
                    "must be supplied in strictly ascending order"
                );
            }
            rt.lastMarketId = newMarketConfigurations[newIdx].marketId;

            // Reject markets with no weight.
            if (newMarketConfigurations[newIdx].weightD18 == 0) {
                revert ParameterError.InvalidParameter("weights", "weight must be non-zero");
            }

            // Note: The following blocks of code compare the incoming market (at newIdx) to an existing market (at oldIdx).
            // newIdx increases once per iteration in the for loop, but oldIdx may increase multiple times if certain conditions are met.

            // If the market id of newIdx is greater than any of the old market ids,
            // consider all the old ones removed and mark them for post verification (increases oldIdx for each).
            while (
                rt.oldIdx < pool.marketConfigurations.length &&
                pool.marketConfigurations[rt.oldIdx].marketId <
                newMarketConfigurations[newIdx].marketId
            ) {
                potentiallyLockedMarkets[rt.potentiallyLockedMarketsIdx++] = pool
                    .marketConfigurations[rt.oldIdx]
                    .marketId;
                removedMarkets[rt.removedMarketsIdx++] = potentiallyLockedMarkets[
                    rt.potentiallyLockedMarketsIdx - 1
                ];

                rt.oldIdx++;
            }

            // If the market id of newIdx is equal to any of the old market ids,
            // consider it updated (increases oldIdx once).
            if (
                rt.oldIdx < pool.marketConfigurations.length &&
                pool.marketConfigurations[rt.oldIdx].marketId ==
                newMarketConfigurations[newIdx].marketId
            ) {
                // Get weight ratios for comparison below.
                // Upscale them to make sure that we have compatible precision in case of very small values.
                // If the market's new maximum share value or weight ratio decreased,
                // mark it for later verification.
                if (
                    newMarketConfigurations[newIdx].maxDebtShareValueD18 <
                    pool.marketConfigurations[rt.oldIdx].maxDebtShareValueD18 ||
                    newMarketConfigurations[newIdx]
                        .weightD18
                        .to256()
                        .upscale(DecimalMath.PRECISION_FACTOR)
                        .divDecimal(totalWeightD18) < // newWeightRatioD27
                    pool
                        .marketConfigurations[rt.oldIdx]
                        .weightD18
                        .to256()
                        .upscale(DecimalMath.PRECISION_FACTOR)
                        .divDecimal(pool.totalWeightsD18) // oldWeightRatioD27
                ) {
                    potentiallyLockedMarkets[
                        rt.potentiallyLockedMarketsIdx++
                    ] = newMarketConfigurations[newIdx].marketId;
                }

                // Get "delayed" markets aka markets with increasing weight
                // this is necessary for cross chain pools, which should wait until pools with reduced weight to acknowledge the change before increasing weight
                if (
                    newMarketConfigurations[newIdx]
                        .weightD18
                        .to256()
                        .upscale(DecimalMath.PRECISION_FACTOR)
                        .divDecimal(totalWeightD18) > // newWeightRatioD27
                    pool
                        .marketConfigurations[rt.oldIdx]
                        .weightD18
                        .to256()
                        .upscale(DecimalMath.PRECISION_FACTOR)
                        .divDecimal(pool.totalWeightsD18) // oldWeightRatioD27
                ) {
                    potentiallyDelayedMarkets[
                        rt.potentiallyDelayedMarketsIdx++
                    ] = newMarketConfigurations[newIdx].marketId;
                }

                rt.oldIdx++;
            }

            // Note: processing or checks for added markets is not necessary.
        } // for end

        // If any of the old markets was not processed up to this point,
        // it means that it is not present in the new array, so mark it for removal.
        while (rt.oldIdx < pool.marketConfigurations.length) {
            removedMarkets[rt.removedMarketsIdx++] = pool.marketConfigurations[rt.oldIdx].marketId;
            rt.oldIdx++;
        }
    }
}
