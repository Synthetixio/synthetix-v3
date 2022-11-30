//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Distribution.sol";
import "./MarketConfiguration.sol";
import "./Vault.sol";
import "./Market.sol";
import "./PoolConfiguration.sol";

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

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
    using DecimalMath for int128;

    error PoolNotFound(uint128 poolId);
    error PoolAlreadyExists(uint128 poolId);

    struct Data {
        /**
         * @dev Numeric identifier for the pool.
         *
         * Must be unique.
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
         * @dev Accumulated cache value of all vault liquidities, i.e. their collateral value minus their debt.
         *
         * TODO: Liquidity as a term is a vague concept. Consider being more consistent all over the code with the use of capacity vs liquidity. i.e. `totalRemainingCreditCapacity`.
         */
        uint128 unusedCreditCapacityD18;
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
         * @dev Collateral types that provide liquidity to this pool and hence to the markets connected to the pool.
         *
         * TODO: This variable doesn't seem to be accessed from anywhere in the code. Consider using it, or emptying the storage slot (not removing it).
         */
        SetUtil.AddressSet collateralTypes;
        /**
         * @dev Reference to all the vaults that provide liquidity to this pool.
         *
         * Each collateral type will have its own vault, specific to this pool. I.e. if two pools both use SNX collateral, each will have its own SNX vault.
         *
         * Vaults track user collateral and debt using a debt distribution, which is connected to the debt distribution chain.
         */
        mapping(address => Vault.Data) vaults;
    }

    /**
     * @dev Returns the pool stored at the specified pool id.
     *
     * TODO: Consider using a constant instead of a hardcoded string here, and likewise to all similar uses of storage access in the code.
     */
    function load(uint128 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("Pool", id));
        assembly {
            data.slot := s
        }
    }

    /**
     * @dev Creates a pool for the given pool id, and assigns the caller as its owner.
     *
     * Reverts if the specified pool already exists.
     */
    function create(uint128 id, address owner) internal returns (Pool.Data storage self) {
        if (Pool.exists(id)) {
            revert PoolAlreadyExists(id);
        }

        self = load(id);

        self.id = id;
        self.owner = owner;
    }

    /**
     * @dev Ticker function that updates the debt distribution chain downwards, from markets into the pool, according to each market's weight.
     *
     * It updates the chain by performing these actions:
     * - Splits the pool's total liquidity of the pool into each market, pro-rata. The amount of shares that the pool has on each market depends on how much liquidity the pool provides to the market.
     * - Accumulates the change in debt value from each market into the pools own vault debt distribution's value per share.
     */
    function distributeDebtToVaults(Data storage self) internal {
        uint totalWeightsD18 = self.totalWeightsD18;

        if (totalWeightsD18 == 0) {
            return; // Nothing to rebalance.
        }

        // Read from storage once, before entering the loop below.
        // These values should not change while iterating through each market.

        // TODO Clarify
        int totalCreditCapacityD18 = int128(self.vaultsDebtDistribution.totalSharesD18);

        // TODO Clarify
        uint128 unusedCreditCapacityD18 = self.unusedCreditCapacityD18;

        int cumulativeDebtChangeD18 = 0;

        // Loop through the pool's markets, applying market weights, and tracking how this changes the amount of debt that this pool is responsible for.
        // This debt extracted from markets is then applied to the pool's vault debt distribution, which thus exposes debt to the pool's vaults.
        for (uint i = 0; i < self.marketConfigurations.length; i++) {
            MarketConfiguration.Data storage marketConfiguration = self.marketConfigurations[i];

            uint weightD18 = marketConfiguration.weightD18;

            // Calculate each market's pro-rata USD liquidity.
            // Note: the factor `(weight / totalWeights)` is not deduped in the operations below to maintain numeric precision.

            // TODO: Consider introducing a SafeCast library. Here, if we didn't check for negative numbers, a cast could result in an overflow (Solidity does not check for casting overflows). Thus, leaving casting free to the developer might introduce bugs. All instances of the code should use this util.
            uint marketCreditCapacityD18 = totalCreditCapacityD18 > 0 ? (uint(totalCreditCapacityD18) * weightD18) / totalWeightsD18 : 0;
            uint marketUnusedCreditCapacityD18 = (unusedCreditCapacityD18 * weightD18) / totalWeightsD18;

            Market.Data storage marketData = Market.load(marketConfiguration.market);

            // Contain the market's maximum debt share value.
            // System-wide.
            int effectiveMaxShareValueD18 = containMarketMaxShareValue(self, marketData, marketUnusedCreditCapacityD18);
            // Market-wide.
            int configuredMaxShareValueD18 = marketConfiguration.maxDebtShareValueD18;
            effectiveMaxShareValueD18 = effectiveMaxShareValueD18 < configuredMaxShareValueD18
                ? effectiveMaxShareValueD18
                : configuredMaxShareValueD18;

            // Update each market's corresponding credit capacity.
            // The returned value represents how much the market's debt changed after changing the shares of this pool actor, which is aggregated to later be passed on the pools debt distribution.
            cumulativeDebtChangeD18 += Market.rebalance(
                marketConfiguration.market,
                self.id,
                effectiveMaxShareValueD18,
                marketCreditCapacityD18
            );
        }

        // Passes on the accumulated debt changes from the markets, into the pool, so that vaults can later access this debt.
        self.vaultsDebtDistribution.distributeValue(cumulativeDebtChangeD18);
    }

    /**
     * @dev Implements a system-wide fail safe to prevent a market from taking too much debt.
     *
     * Note: There is a non-system-wide fail safe for each market at `MarketConfiguration.maxDebtShareValue`.
     *
     * See `PoolConfiguration.minLiquidityRatio`.
     *
     * TODO: Consider renaming these two fail safes in a more consistent manner. One is max<Something>, and the other is min<Something>. A common nomenclature might ease understanding how the two work.
     */
    function containMarketMaxShareValue(
        Data storage self,
        Market.Data storage marketData,
        uint creditCapacityD18
    ) internal view returns (int) {
        uint minLiquidityRatioD18 = PoolConfiguration.load().minLiquidityRatioD18;

        // TODO Explain the math in this block...
        // TODO Name `thing` variable accordingly once I understand the math.
        // thing = liquidity / minRatio / totalShares
        // ratio = liquidity / totalShares
        // then, thing = liquidity / totalShares / minRatio
        // so, thing = ratio / minRatio
        // if ratio == minRatio, thing = 1
        // if ratio < minRatio, thing < 1
        // if ratio > minRatio, thing > 1
        int thingD18;
        if (minLiquidityRatioD18 == 0) {
            thingD18 = int(DecimalMath.UNIT); // If minLiquidityRatioD18 is zero, then TODO
        } else {
            // maxShareValueIncrease?
            thingD18 = int(creditCapacityD18.divDecimal(minLiquidityRatioD18).divDecimal(self.vaultsDebtDistribution.totalSharesD18));
        }

        return int256(marketData.poolsDebtDistribution.valuePerShareD27 / DecimalMath.PRECISION_DOWN_SCALE_INT128) + thingD18;
    }

    /**
     * @dev Returns true if a pool with the specified id exists.
     *
     * TODO: Hidden logic: What is pool 0, and why does it always "exist"?
     */
    function exists(uint128 id) internal view returns (bool) {
        return id == 0 || load(id).id == id;
    }

    /**
     * @dev Returns true if the pool is exposed to the specified market.
     *
     * TODO: Wouldn't it help to use a Set here?
     */
    function hasMarket(Data storage self, uint128 marketId) internal view returns (bool) {
        for (uint i = 0; i < self.marketConfigurations.length; i++) {
            if (self.marketConfigurations[i].market == marketId) {
                return true;
            }
        }

        return false;
    }

    /**
     * @dev Ticker function that updates the debt distribution chain for a specific collateral type downwards, from the pool into the corresponding the vault, according to changes in the collateral's price.
     *
     * It updates the chain by performing these actions:
     * - Collects the latest price of the corresponding collateral and updates the vault's liquidity.
     * - Updates the vaults shares in the pool's debt distribution, according to the collateral provided by the vault.
     * - Updates the value per share of the vault's debt distribution.
     *
     * TODO: If possible, remove second call to distributeDebtToVaults.
     */
    function recalculateVaultCollateral(Data storage self, address collateralType) internal returns (uint collateralPriceD18) {
        // Update each market's pro-rata liquidity and collect accumulated debt into the pool's debt distribution.
        distributeDebtToVaults(self);

        // Get the latest collateral price.
        collateralPriceD18 = CollateralConfiguration.load(collateralType).getCollateralPrice();

        // Changes in price update the corresponding vault's total collateral value as well as its liquidity (collateral - debt).
        (uint usdWeightD18, , int deltaLiquidityD18) = self.vaults[collateralType].updateLiquidity(collateralPriceD18);

        // Update the vault's shares in the pool's debt distribution, according to the value of its collateral.
        bytes32 actorId = bytes32(uint(uint160(collateralType)));
        int debtChangeD18 = self.vaultsDebtDistribution.getActorValueChange(actorId);
        self.vaultsDebtDistribution.setActorShares(actorId, usdWeightD18);

        // Accumulate the change in total liquidity, from the vault, into the pool.
        self.unusedCreditCapacityD18 = uint128(int128(self.unusedCreditCapacityD18) + int128(deltaLiquidityD18));

        // Transfer the debt change from the pool into the vault.
        self.vaults[collateralType].distributeDebtToAccounts(debtChangeD18);

        // Distribute debt again because... TODO
        distributeDebtToVaults(self);
    }

    /**
     * @dev Updates the debt distribution chain for this pool, and consolidates the given account's debt.
     */
    function updateAccountDebt(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal returns (int debtD18) {
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
    function currentVaultCollateralRatio(Data storage self, address collateralType) internal returns (uint) {
        recalculateVaultCollateral(self, collateralType);

        int debtD18 = self.vaults[collateralType].currentDebt();
        (, uint collateralValueD18) = currentVaultCollateral(self, collateralType);

        return debtD18 > 0 ? uint(debtD18).divDecimal(collateralValueD18) : 0;
    }

    // TODO: Document
    function findMarketCapacityLocked(Data storage self) internal view returns (Market.Data storage lockedMarketId) {
        for (uint i = 0; i < self.marketConfigurations.length; i++) {
            Market.Data storage market = Market.load(self.marketConfigurations[i].market);

            if (market.isCapacityLocked()) {
                return market;
            }
        }

        return Market.load(0);
    }

    /**
     * @dev Returns if a portion of the liquidity in this pool cannot be withdrawn due to upstream market `locked`.
     *
     * TODO: Review documentation.
     */
    function getLockedLiquidityObligation(Data storage self) internal view returns (uint) {
        uint lockedD18 = 0;
        for (uint i = 0; i < self.marketConfigurations.length; i++) {
            Market.Data storage market = Market.load(self.marketConfigurations[i].market);

            uint unlockedD18 = market.capacityD18 - market.getLockedLiquidity();
            uint contributedCapacityD18 = market.getCapacityContribution(
                market.getPoolLiquidity(self.id),
                self.marketConfigurations[i].maxDebtShareValueD18
            );

            if (unlockedD18 < contributedCapacityD18) {
                lockedD18 += contributedCapacityD18 - unlockedD18;
            }
        }

        return lockedD18;
    }

    /**
     * @dev Returns the debt of the vault that tracks the given collateral type.
     *
     * The vault's debt is the vault's share of the total debt of the pool, or its share of the total debt of the markets connected to the pool. The size of this share depends on how much collateral the pool provides to the pool.
     *
     * Note: This is not a view function. It updates the debt distribution chain before performing any calculations.
     */
    function currentVaultDebt(Data storage self, address collateralType) internal returns (int) {
        recalculateVaultCollateral(self, collateralType);

        return self.vaults[collateralType].currentDebt();
    }

    /**
     * @dev Returns the total amount and value of the specified collateral delegated to this pool.
     *
     * TODO: Understand and document why mulDecimal is used here instead of *.
     */
    function currentVaultCollateral(Data storage self, address collateralType)
        internal
        view
        returns (uint collateralAmountD18, uint collateralValueD18)
    {
        uint collateralPriceD18 = CollateralConfiguration.load(collateralType).getCollateralPrice();

        collateralAmountD18 = self.vaults[collateralType].currentCollateral();
        collateralValueD18 = collateralPriceD18.mulDecimal(collateralAmountD18);
    }

    /**
     * @dev Returns the amount and value of collateral that the specified account has delegated to this pool.
     *
     * TODO: Understand and document why mulDecimal is used here instead of *.
     */
    function currentAccountCollateral(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal view returns (uint collateralAmountD18, uint collateralValueD18) {
        uint collateralPriceD18 = CollateralConfiguration.load(collateralType).getCollateralPrice();

        collateralAmountD18 = self.vaults[collateralType].currentAccountCollateral(accountId);
        collateralValueD18 = collateralPriceD18.mulDecimal(collateralAmountD18);
    }

    /**
     * @dev Returns the specified account's collateralization ratio (collateral / debt).
     */
    function currentAccountCollateralizationRatio(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal returns (uint) {
        (, uint getPositionCollateralValueD18) = currentAccountCollateral(self, collateralType, accountId);
        int getPositionDebtD18 = updateAccountDebt(self, collateralType, accountId);

        // if they have a credit, just treat their debt as 0
        return getPositionCollateralValueD18.divDecimal(getPositionDebtD18 < 0 ? 0 : uint(getPositionDebtD18));
    }

    /**
     * @dev Reverts if the specified pool does not exist.
     */
    function requireExists(uint128 poolId) internal view {
        if (!Pool.exists(poolId)) {
            revert PoolNotFound(poolId);
        }
    }

    /**
     * @dev Reverts if the caller is not the owner of the specified pool.
     */
    function onlyPoolOwner(uint128 poolId, address caller) internal view {
        if (Pool.load(poolId).owner != caller) {
            revert AccessError.Unauthorized(caller);
        }
    }
}
