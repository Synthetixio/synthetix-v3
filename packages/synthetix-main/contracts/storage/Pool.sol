//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Distribution.sol";
import "./MarketDistribution.sol";
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

    struct Data {
        /**
         * @dev Unique numeric identifier for the pool.
         */
        uint128 id;
        /**
         * @dev Non-unique text identifier for the pool.
         */
        string name;
        /**
         * @dev Creator of the pool, which has additional access rights for configuring the pool.
         *
         * See onlyPoolOwner.
         */
        address owner;
        /**
         * @dev Allows the current pool owner to nominate a new owner, and thus transfer pool configuration control.
         */
        address nominatedOwner;
        /**
         * @dev TODO
         */
        /// @dev sum of all distributions for the pool
        /// sum of distribution weights
        // TODO: Understand rebalanceConfigurations()
        uint128 totalWeights;
        /**
         * @dev TODO
         */
        /// sum of all vaults last revealed remaining liquidity
        // TODO: Understand rebalanceConfigurations()
        uint128 totalRemainingLiquidity;
        /**
         * @dev TODO
         */
        // TODO: Rename to marketDistribution? Also, the name "distribution" is confusing, since it seems to refer to the distribution concept used in Vaults, etc.
        /// @dev pool distribution
        // TODO: Understand rebalanceConfigurations()
        MarketDistribution.Data[] poolDistribution;
        /**
         * @dev TODO
         */
        /// @dev tracks debt for the pool
        // TODO: Understand rebalanceConfigurations()
        Distribution.Data debtDist;
        /**
         * @dev TODO Collateral types delegated to this pool.
         *
         * TODO: Where is this accessed/referenced from? Not here.
         */
        SetUtil.AddressSet collateralTypes;
        /**
         * @dev Tracks user collateral and debt distribution for each collateral type.
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
     * @dev TODO Creates a pool for the given id and assigns the caller as its owner.
     *
     * Reverts if the pool already exists.
     * TODO: Revert if pool already exists. As is, anyone can take over any pool.
     */
    function create(uint128 id, address owner) internal returns (Pool.Data storage self) {
        self = load(id);

        // TODO: throw if pool is already created?

        self.id = id;
        self.owner = owner;
    }

    /**
     * @dev TODO
     */
    function distributeDebt(Data storage self) internal {
        rebalanceConfigurations(self);
    }

    /**
     * @dev TODO
     * TODO: Understand called functions.
     */
    function rebalanceConfigurations(Data storage self) internal {
        uint totalWeights = self.totalWeights;

        if (totalWeights == 0) {
            // nothing to rebalance
            return;
        }

        Distribution.Data storage poolDist = self.debtDist;

        // after applying the pool share multiplier, we have USD liquidity

        int totalAllocatableLiquidity = int128(self.debtDist.totalShares);
        int cumulativeDebtChange = 0;

        for (uint i = 0; i < self.poolDistribution.length; i++) {
            MarketDistribution.Data storage marketDistribution = self.poolDistribution[i];
            uint weight = marketDistribution.weight;
            uint amount = totalAllocatableLiquidity > 0 ? (uint(totalAllocatableLiquidity) * weight) / totalWeights : 0;

            Market.Data storage marketData = Market.load(marketDistribution.market);

            int permissibleLiquidity = calculatePermissibleLiquidity(
                self,
                marketData,
                (self.totalRemainingLiquidity * weight) / totalWeights
            );

            cumulativeDebtChange += Market.rebalance(
                marketDistribution.market,
                self.id,
                permissibleLiquidity < marketDistribution.maxDebtShareValue
                    ? permissibleLiquidity
                    : marketDistribution.maxDebtShareValue,
                amount
            );
        }

        poolDist.distributeValue(cumulativeDebtChange);
    }

    /**
     * @dev TODO
     * TODO: Understand math.
     */
    function calculatePermissibleLiquidity(
        Data storage self,
        Market.Data storage marketData,
        uint remainingLiquidity
    ) internal view returns (int) {
        uint minRatio = PoolConfiguration.load().minLiquidityRatio;
        return
            marketData.debtDist.valuePerShare /
            1e9 +
            int(
                minRatio > 0 ? remainingLiquidity.divDecimal(minRatio).divDecimal(self.debtDist.totalShares) : MathUtil.UNIT
            );
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
        for (uint i = 0; i < self.poolDistribution.length; i++) {
            if (self.poolDistribution[i].market == marketId) {
                return true;
            }
        }

        return false;
    }

    /**
     * @dev TODO
     *
     * // TODO: Understand distributeDebt().
     * // TODO: Review interactions with Vault.
     * // TODO: Understand rebalanceConfigurations().
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

        rebalanceConfigurations(self);
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
