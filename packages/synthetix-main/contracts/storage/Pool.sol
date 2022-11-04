//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Distribution.sol";
import "./MarketConfiguration.sol";
import "./Vault.sol";
import "./Market.sol";
import "./PoolConfiguration.sol";

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

/**
 * @title TODO Aggregates collateral from multiple users in order to provide liquidity to a configurable set of markets.
 */
library Pool {
    using CollateralConfiguration for CollateralConfiguration.Data;
    using Market for Market.Data;
    using Vault for Vault.Data;
    using Distribution for Distribution.Data;
    using MathUtil for uint256;

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
         * Market weights are tracked in MarketConfiguration.weight, one for each market. The ratio of each market.weight / totalWeights determines the pro-rata share of the market to the pool's total liquidity, as well as on what proportion the pool is exposed to the market's debt.
         */
        uint128 totalWeights;
        /**
         * @dev TODO
         *
         * Cache variable. The sum of all of the dollar value of the collateral of all vaults - the amount of debt that is accumulated to all the vaults.
         */
        /// sum of all vaults last revealed remaining liquidity
        // TODO: Understand distributeDebt()
        uint128 totalRemainingLiquidity;
        /**
         * @dev TODO
         */
        /// @dev Market distribution
        // TODO: Understand distributeDebt()
        MarketConfiguration.Data[] marketConfigurations;
        /**
         * @dev TODO
         *
         * Debt distribution chain.
         *
         * Market level - first place that debt gets accumulated
         * Each market has many pools connected to it. Distributes that debt to the pools based on how much liquidity they are providing.
         *
         * Pool - this here <<====================
         * Each pool has many vaults connected to it. Distributes debt to the vaults based on how much liquidity they are providing.
         *
         * Vaults to users - last place that debt gets accumulated, but consolidated when users interact, very end of the chain
         * Each vault has many accounts connected to it. Distributes debt to the users based on how much liquidity they are providing.
         *
         * - Trigger: When user interacts, they ping this chain to be updated
         * - Trigger: setPoolConfiguration
         */
        /// @dev tracks debt for the pool
        // TODO: Understand distributeDebt()
        Distribution.Data debtDist;
        /**
         * @dev TODO Collateral types delegated to this pool.
         *
         * TODO: Where is this accessed/referenced from? Not here.
         */
        SetUtil.AddressSet collateralTypes;
        /**
         * @dev Tracks collateral and debt distribution for each user, for each collateral type, in this pool.
         */
        mapping(address => Vault.Data) vaults;
    }

    /**
     * @dev Returns the pool stored at the specified pool id.
     *
     * TODO: Consider using a constant instead of a hardcoded string.
     */
    function load(uint128 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("Pool", id));
        assembly {
            data.slot := s
        }
    }

    /**
     * @dev Creates a pool for the given id, and assigns the caller as its owner.
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
     * @dev TODO
     *
     * Ticker
     *
     * Two things:
     * 1) Recalculates amount of liquidity available for all the markets, updates that on the market level
     * 2) As it does this, gets back the amount of debt accum on each of the market, so it passes that down the distribution chain
     *
     * As the debt is changing the value of the shares is changes as well, so makes sense to do both at once.
     *
     * TODO: Understand calculatePermissibleLiquidity()
     * TODO: Understand Market.rebalance()
     * TODO: Understand poolDist.distributeValue()
     */
    function distributeDebt(Data storage self) internal {
        uint totalWeights = self.totalWeights;

        if (totalWeights == 0) {
            return; // Nothing to rebalance.
        }

        // TODO: Put this comment in a better context?
        // after applying the pool share multiplier, we have USD liquidity

        // Read from storage once, before entering the loop below.
        // These values should not change while iterating.
        int totalAllocatableLiquidity = int128(self.debtDist.totalShares);
        // TODO: Watch out for shadowing here...
        uint128 totalRemainingLiquidity = self.totalRemainingLiquidity;

        int cumulativeDebtChange = 0;

        // Loop through the pool's markets.
        for (uint i = 0; i < self.marketConfigurations.length; i++) {
            MarketConfiguration.Data storage marketConfiguration = self.marketConfigurations[i];

            uint weight = marketConfiguration.weight;

            // Note: the factor weight / totalWeights is not deduped below to maintain numeric precision.

            // TODO: Review variable renaming here one more time, might have broken something.

            // TODO: Possible CRITICAL BUG - If the int totalAllocatableLiquidity is negative, the casting to uint
            // below will cause an overflow; a tiny negative number becomes a humongous positive number.
            // We might need to do a general review of how ints are casted into uints for calculations that involve both types.
            uint proRataAllocatableLiquidity = totalAllocatableLiquidity > 0
                ? (uint(totalAllocatableLiquidity) * weight) / totalWeights
                : 0;
            uint proRataRemainingLiquidity = (totalRemainingLiquidity * weight) / totalWeights;

            Market.Data storage marketData = Market.load(marketConfiguration.market);
            int permissibleLiquidity = calculateMarketPermissibleLiquidity(self, marketData, proRataRemainingLiquidity);

            cumulativeDebtChange += Market.rebalance(
                marketConfiguration.market,
                self.id,
                permissibleLiquidity < marketConfiguration.maxDebtShareValue
                    ? permissibleLiquidity
                    : marketConfiguration.maxDebtShareValue,
                proRataAllocatableLiquidity
            );
        }

        // TODO Passes the debt accumulated down the chain
        self.debtDist.distributeValue(cumulativeDebtChange);
    }

    /**
     * @dev TODO
     *
     * System enforced fail safe.
     *
     * Prevent a market from taking too much debt.
     * Determines max value proportional for the market.
     * min: 200%
     *
     * Secondary limit maxDebtPerShare, which is more per market.
     *
     * 2 fail safes.
     *
     * TODO: Understand debt distribution.
     * TODO: Understand math.
     * TODO: Consider rename.
     */
    function calculateMarketPermissibleLiquidity(
        Data storage self,
        Market.Data storage marketData,
        uint proRataLiquidity
    ) internal view returns (int) {
        uint minLiquidityRatio = PoolConfiguration.load().minLiquidityRatio;

        // Value per share is high precision (1e27), so downscale to 1e18.
        int128 marketDebtValuePerShare = marketData.debtDist.valuePerShare / 1e9;

        if (minLiquidityRatio == 0) {
            return marketDebtValuePerShare + int(MathUtil.UNIT);
        }

        // TODO name accordingly once I understand the math.
        // maxShareValueIncrease?
        int thing = int(proRataLiquidity.divDecimal(minLiquidityRatio).divDecimal(self.debtDist.totalShares));
        return marketDebtValuePerShare + thing;
    }

    /**
     * @dev Returns true if a pool with the specified id exists.
     *
     * TODO: What is pool 0, and why does it always "exist"?
     */
    function exists(uint128 id) internal view returns (bool) {
        return id == 0 || load(id).id == id;
    }

    /**
     * @dev Returns true if the pool is exposed to the specified market.
     *
     * TODO: Wouldn't it help to use a set here?
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
     * @dev TODO
     *
     * Ticker
     *
     * If You give it a vault, calculates updated amount of collateral and assign debt to it
     * Going further down the chain from the market, down the debt distribution chain
     *
     * Up chain - markets
     * Down chain - users
     *
     * If possible, remove call to dsitribute
     *
     * // TODO: Understand distributeDebt().
     * // TODO: Review interactions with Vault.
     * // TODO: Understand distributeDebt().
     */
    function recalculateVaultCollateral(Data storage self, address collateralType) internal returns (uint collateralPrice) {
        // assign accumulated debt
        distributeDebt(self);

        // update vault collateral
        collateralPrice = CollateralConfiguration.load(collateralType).getCollateralPrice();

        bytes32 actorId = bytes32(uint(uint160(collateralType)));
        (uint usdWeight, , int deltaRemainingLiquidity) = self.vaults[collateralType].updateLiquidity(collateralPrice);

        int debtChange = self.debtDist.updateActorShares(actorId, usdWeight);

        self.totalRemainingLiquidity = uint128(int128(self.totalRemainingLiquidity) + int128(deltaRemainingLiquidity));

        self.vaults[collateralType].distributeDebt(debtChange);

        distributeDebt(self);
    }

    /**
     * @dev TODO
     *
     * TODO: Understand recalculateVaultCollateral().
     */
    function updateAccountDebt(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal returns (int debt) {
        recalculateVaultCollateral(self, collateralType);

        return self.vaults[collateralType].consolidateAccountDebt(accountId);
    }

    /**
     * @dev TODO Clears all vault data for the specified collateral type.
     *
     * TODO: Understand recalculateVaultCollateral().
     */
    function resetVault(Data storage self, address collateralType) internal {
        // reboot the vault
        self.vaults[collateralType].reset();

        // this will ensure the pool's values are brought back in sync after the reset
        recalculateVaultCollateral(self, collateralType);
    }

    /**
     * @dev TODO
     *
     * TODO: Understand recalculateVaultCollateral().
     */
    function currentVaultCollateralRatio(Data storage self, address collateralType) internal returns (uint) {
        recalculateVaultCollateral(self, collateralType);

        int debt = self.vaults[collateralType].currentDebt();
        (, uint collateralValue) = currentVaultCollateral(self, collateralType);

        return debt > 0 ? uint(debt).divDecimal(collateralValue) : 0;
    }

    /**
     * @dev TODO
     *
     * TODO: Understand recalculateVaultCollateral().
     */
    function currentVaultDebt(Data storage self, address collateralType) internal returns (int) {
        recalculateVaultCollateral(self, collateralType);

        return self.vaults[collateralType].currentDebt();
    }

    /**
     * @dev Returns the total amount and value of the specified collateral delegated to this pool.
     *
     * TODO: Understand why mulDecimal is used here instead of *.
     */
    function currentVaultCollateral(Data storage self, address collateralType)
        internal
        view
        returns (uint collateralAmount, uint collateralValue)
    {
        uint collateralPrice = CollateralConfiguration.load(collateralType).getCollateralPrice();

        collateralAmount = self.vaults[collateralType].currentCollateral();
        collateralValue = collateralPrice.mulDecimal(collateralAmount);
    }

    /**
     * @dev TODO Returns the amount and value of collateral that the specified account has delegated to this pool.
     *
     * TODO: Understand why mulDecimal is used here instead of *.
     */
    function currentAccountCollateral(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal view returns (uint collateralAmount, uint collateralValue) {
        uint collateralPrice = CollateralConfiguration.load(collateralType).getCollateralPrice();

        collateralAmount = self.vaults[collateralType].currentAccountCollateral(accountId);
        collateralValue = collateralPrice.mulDecimal(collateralAmount);
    }

    /**
     * @dev TODO Returns the specified account's collateralization ratio (collateral / debt).
     *
     * TODO: Understand updateAccountDebt().
     */
    function currentAccountCollateralizationRatio(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal returns (uint) {
        (, uint getPositionCollateralValue) = currentAccountCollateral(self, collateralType, accountId);
        int getPositionDebt = updateAccountDebt(self, collateralType, accountId);

        // if they have a credit, just treat their debt as 0
        return getPositionCollateralValue.divDecimal(getPositionDebt < 0 ? 0 : uint(getPositionDebt));
    }

    /**
     * @dev Reverts if the specified pool does not exist.
     */
    function requireExists(uint128 poolId) internal {
        if (!Pool.exists(poolId)) {
            revert PoolNotFound(poolId);
        }
    }

    /**
     * @dev Reverts if the caller is not the owner of the specified pool.
     *
     * TODO: Why use "requestor" instead of msg.sender?
     * TODO: Lol probably a better name than "requestor".
     */
    function onlyPoolOwner(uint128 poolId, address requestor) internal {
        if (Pool.load(poolId).owner != requestor) {
            revert AccessError.Unauthorized(requestor);
        }
    }
}
