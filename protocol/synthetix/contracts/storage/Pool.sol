//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Distribution.sol";
import "./MarketConfiguration.sol";
import "./Vault.sol";
import "./Market.sol";
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

    struct Data {
        /**
         * @dev Numeric identifier for the pool. Must be unique.
         * @dev A pool with id zero exists! (See Pool.exists()). Users can delegate to this pool to be able to mint USD without being exposed to fluctuating debt.
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
    }

    /**
     * @dev Returns the pool stored at the specified pool id.
     */
    function load(uint128 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.Pool", id));
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
        uint256 totalWeightsD18 = self.totalWeightsD18;

        if (totalWeightsD18 == 0) {
            return; // Nothing to rebalance.
        }

        // Read from storage once, before entering the loop below.
        // These values should not change while iterating through each market.
        uint256 totalCreditCapacityD18 = self.vaultsDebtDistribution.totalSharesD18;
        int128 totalDebtD18 = self.totalVaultDebtsD18;

        int256 cumulativeDebtChangeD18 = 0;

        // Loop through the pool's markets, applying market weights, and tracking how this changes the amount of debt that this pool is responsible for.
        // This debt extracted from markets is then applied to the pool's vault debt distribution, which thus exposes debt to the pool's vaults.
        for (uint256 i = 0; i < self.marketConfigurations.length; i++) {
            MarketConfiguration.Data storage marketConfiguration = self.marketConfigurations[i];

            uint256 weightD18 = marketConfiguration.weightD18;

            // Calculate each market's pro-rata USD liquidity.
            // Note: the factor `(weight / totalWeights)` is not deduped in the operations below to maintain numeric precision.

            uint256 marketCreditCapacityD18 = (totalCreditCapacityD18 * weightD18) /
                totalWeightsD18;
            int256 marketDebtD18 = (totalDebtD18 * weightD18.toInt()) / totalWeightsD18.toInt();

            Market.Data storage marketData = Market.load(marketConfiguration.marketId);

            // Contain the pool imposed market's maximum debt share value.
            // Imposed by system.
            int256 effectiveMaxShareValueD18 = getSystemMaxValuePerShare(
                self,
                marketData.id,
                marketCreditCapacityD18,
                marketDebtD18
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

        // Passes on the accumulated debt changes from the markets, into the pool, so that vaults can later access this debt.
        self.vaultsDebtDistribution.distributeValue(cumulativeDebtChangeD18);
    }

    /**
     * @dev Implements a system-wide fail safe to prevent a market from taking too much debt.
     *
     * Note: There is a non-system-wide fail safe for each market at `MarketConfiguration.maxDebtShareValue`.
     *
     * See `SystemPoolConfiguration.minLiquidityRatio`.
     */
    function getSystemMaxValuePerShare(
        Data storage self,
        uint128 marketId, // we are keeping this value as a uint128 for now for testability reasons
        uint256 creditCapacityD18,
        int256 debtD18
    ) internal view returns (int256) {
        Market.Data storage marketData = Market.load(marketId);
        uint256 minLiquidityRatioD18 = SystemPoolConfiguration.load().minLiquidityRatioD18;

        // Calculate the margin of debt that the market could incur to hit the system wide limit.
        uint256 totalSharesD18 = self.vaultsDebtDistribution.totalSharesD18;
        int256 valuePerShareD18 = marketData.poolsDebtDistribution.getValuePerShare();

        if (minLiquidityRatioD18 == 0) {
            // If minLiquidityRatioD18 is zero, then set limit to 100%.
            return valuePerShareD18 + DecimalMath.UNIT_INT;
        } else if (totalSharesD18 == 0) {
            // margin = credit / systemLimit, per share
            return valuePerShareD18;
        } else {
            uint256 marginD18 = creditCapacityD18.divDecimal(minLiquidityRatioD18).divDecimal(
                totalSharesD18
            );

            return
                marketData.poolsDebtDistribution.getValuePerShare() +
                marginD18.toInt() -
                debtD18.divDecimal(totalSharesD18.toInt());
        }
    }

    /**
     * @dev Returns true if a pool with the specified id exists.
     *
     * Note: Pool zero always exists, see "Pool.id".
     */
    function exists(uint128 id) internal view returns (bool) {
        return id == 0 || load(id).id == id;
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
        // Update each market's pro-rata liquidity and collect accumulated debt into the pool's debt distribution.
        distributeDebtToVaults(self);

        // Transfer the debt change from the pool into the vault.
        bytes32 actorId = collateralType.toBytes32();
        self.vaults[collateralType].distributeDebtToAccounts(
            self.vaultsDebtDistribution.accumulateActor(actorId)
        );

        // Get the latest collateral price.
        collateralPriceD18 = CollateralConfiguration.load(collateralType).getCollateralPrice();

        // Changes in price update the corresponding vault's total collateral value as well as its liquidity (collateral - debt).
        (uint256 usdWeightD18, , int256 deltaDebtD18) = self
            .vaults[collateralType]
            .updateCreditCapacity(collateralPriceD18);

        // Update the vault's shares in the pool's debt distribution, according to the value of its collateral.
        self.vaultsDebtDistribution.setActorShares(actorId, usdWeightD18);

        // Accumulate the change in total liquidity, from the vault, into the pool.
        self.totalVaultDebtsD18 = self.totalVaultDebtsD18 + deltaDebtD18.to128();

        // Distribute debt again because the market credit capacity may have changed, so we should ensure the vaults have the most up to date capacities
        distributeDebtToVaults(self);
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
        recalculateVaultCollateral(self, collateralType);

        int256 debtD18 = self.vaults[collateralType].currentDebt();
        (, uint256 collateralValueD18) = currentVaultCollateral(self, collateralType);

        return debtD18 > 0 ? debtD18.toUint().divDecimal(collateralValueD18) : 0;
    }

    /**
     * @dev Finds a connected market whose credit capacity has reached its locked limit.
     *
     * Note: Returns market zero (null market) if none is found.
     */
    function findMarketWithCapacityLocked(
        Data storage self
    ) internal view returns (Market.Data storage lockedMarketId) {
        for (uint256 i = 0; i < self.marketConfigurations.length; i++) {
            Market.Data storage market = Market.load(self.marketConfigurations[i].marketId);

            if (market.isCapacityLocked()) {
                return market;
            }
        }

        // Market zero = null market.
        return Market.load(0);
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
     */
    function currentAccountCollateralizationRatio(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal returns (uint256) {
        (, uint256 getPositionCollateralValueD18) = currentAccountCollateral(
            self,
            collateralType,
            accountId
        );
        int256 getPositionDebtD18 = updateAccountDebt(self, collateralType, accountId);

        // if they have a credit, just treat their debt as 0
        return
            getPositionCollateralValueD18.divDecimal(
                getPositionDebtD18 < 0 ? 0 : getPositionDebtD18.toUint()
            );
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
