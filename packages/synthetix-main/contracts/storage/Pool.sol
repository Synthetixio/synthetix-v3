//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Distribution.sol";
import "./MarketDistribution.sol";
import "./Vault.sol";
import "./Market.sol";
import "./PoolConfiguration.sol";

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

library Pool {
    using CollateralConfiguration for CollateralConfiguration.Data;
    using Market for Market.Data;
    using Vault for Vault.Data;
    using Distribution for Distribution.Data;

    using MathUtil for uint256;

    error PoolNotFound(uint128 poolId);

    struct Data {
        /// @dev the id of this pool
        uint128 id;
        /// @dev pool name
        string name;
        /// @dev pool owner
        address owner;
        /// @dev nominated pool owner
        address nominatedOwner;
        /// @dev sum of all distributions for the pool
        uint128 totalWeights; // sum of distribution weights
        uint128 totalRemainingLiquidity; // sum of all vaults last revealed remaining liquidity
        /// @dev pool distribution
        MarketDistribution.Data[] poolDistribution;
        /// @dev tracks debt for the pool
        Distribution.Data debtDist;
        SetUtil.AddressSet collateralTypes;
        mapping(address => Vault.Data) vaults;
    }

    function load(uint128 id) internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("Pool", id));
        assembly {
            data.slot := s
        }
    }

    function create(uint128 id, address owner) internal returns (Pool.Data storage self) {
        self = load(id);

        self.id = id;
        self.owner = owner;
    }

    function distributeDebt(Data storage self) internal {
        rebalanceConfigurations(self);
    }

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

    function exists(uint128 id) internal view returns (bool) {
        return id == 0 || load(id).id == id;
    }

    function hasMarket(Data storage self, uint128 marketId) internal view returns (bool) {
        for (uint i = 0; i < self.poolDistribution.length; i++) {
            if (self.poolDistribution[i].market == marketId) {
                return true;
            }
        }

        return false;
    }

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

    function updateAccountDebt(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal returns (int debt) {
        recalculateVaultCollateral(self, collateralType);

        return self.vaults[collateralType].consolidateAccountDebt(accountId);
    }

    function resetVault(Data storage self, address collateralType) internal {
        // reboot the vault
        self.vaults[collateralType].reset();

        // this will ensure the pool's values are brought back in sync after the reset
        recalculateVaultCollateral(self, collateralType);
    }

    function currentVaultCollateralRatio(Data storage self, address collateralType) internal returns (uint) {
        recalculateVaultCollateral(self, collateralType);

        int debt = self.vaults[collateralType].currentDebt();
        (, uint collateralValue) = currentVaultCollateral(self, collateralType);

        return debt > 0 ? uint(debt).divDecimal(collateralValue) : 0;
    }

    function currentVaultDebt(Data storage self, address collateralType) internal returns (int) {
        recalculateVaultCollateral(self, collateralType);

        return self.vaults[collateralType].currentDebt();
    }

    function currentVaultCollateral(Data storage self, address collateralType)
        internal
        view
        returns (uint collateralAmount, uint collateralValue)
    {
        collateralAmount = self.vaults[collateralType].currentCollateral();
        collateralValue = CollateralConfiguration.load(collateralType).getCollateralPrice().mulDecimal(collateralAmount);
    }

    function currentAccountCollateral(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal view returns (uint collateralAmount, uint collateralValue) {
        collateralAmount = self.vaults[collateralType].currentAccountCollateral(accountId);
        collateralValue = CollateralConfiguration.load(collateralType).getCollateralPrice().mulDecimal(collateralAmount);
    }

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

    function requireExists(uint128 poolId) internal {
        if (!Pool.exists(poolId)) {
            revert PoolNotFound(poolId);
        }
    }

    function onlyPoolOwner(uint128 poolId, address requestor) internal {
        if (Pool.load(poolId).owner != requestor) {
            revert AccessError.Unauthorized(requestor);
        }
    }
}
