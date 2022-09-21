//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Distribution.sol";
import "./MarketDistribution.sol";
import "./Vault.sol";

import "./Market.sol";
import "./PoolConfiguration.sol";

library Pool {
    using Market for Market.Data;
    using Vault for Vault.Data;
    using Distribution for Distribution.Data;

    using MathUtil for uint256;

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
        uint256 totalWeights; // sum of distribution weights
        /// @dev pool distribution
        MarketDistribution.Data[] poolDistribution;
        /// @dev tracks debt for the pool
        Distribution.Data debtDist;
        /// @dev tracks USD liquidity provided by connected vaults. Unfortunately this value has to be computed/updated separately from shares
        /// because liquidations can cause share count to deviate from actual liquidity.
        /// Is signed integer because a pool could technically go completely underwater, but this is unlikely
        int128 totalLiquidity;
        // we might want to use this in the future, can be renamed when that time comes, possibly liquidation related
        uint128 unused;

        SetUtil.AddressSet collateralTypes;
        mapping (address => Vault.Data) vaults;
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

    /**
     * used to officially add collateral to a pool. updates all the internal accounting as necessary.
     * `accountId` to 0 means "airdrop" tokens to all users
     */
    function assignCollateral(Data storage self, address collateralType, uint128 accountId) internal {
        if (accountId == 0) {
            
        } else {

        }

        // update totalLiquidity
    }

    /**
     * used to officially remove collateral from a pool. updates all the internal accounting as necessary.
     * `accountId` to 0 means to deduct tokens from all users proportionally
     */
    function unassignCollateral(Data storage self, address collateralType, uint128 accountId) internal {

        // update totalLiquidity
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

        int totalAllocatableLiquidity = self.totalLiquidity;
        int cumulativeDebtChange = 0;

        for (uint i = 0; i < self.poolDistribution.length; i++) {
            MarketDistribution.Data storage marketDistribution = self.poolDistribution[i];
            uint weight = marketDistribution.weight;
            uint amount = totalAllocatableLiquidity > 0 ? (uint(totalAllocatableLiquidity) * weight) / totalWeights : 0;

            Market.Data storage marketData = Market.load(marketDistribution.market);

            int permissibleLiquidity = calculatePermissibleLiquidity(marketData);

            cumulativeDebtChange += marketData.rebalance(
                self.id,
                permissibleLiquidity < marketDistribution.maxDebtShareValue
                    ? permissibleLiquidity
                    : marketDistribution.maxDebtShareValue,
                amount
            );
        }

        poolDist.distribute(cumulativeDebtChange);
    }

    function calculatePermissibleLiquidity(Market.Data storage marketData) internal view returns (int) {
        uint minRatio = PoolConfiguration.load().minLiquidityRatio;
        return
            marketData.debtDist.valuePerShare / 1e9 + int(minRatio > 0 ? MathUtil.UNIT.divDecimal(minRatio) : MathUtil.UNIT);
    }

    function exists(Data storage self) internal view returns (bool) {
        return self.owner != address(0);
    }

    function recalculateVaultCollateral(Data storage self, address collateralType) internal {
        // assign accumulated debt
        distributeDebt(self);

        // update vault collateral

        bytes32 actorId = bytes32(uint(uint160(collateralType)));
        uint oldVaultShares = self.debtDist.getActorShares(actorId);
        uint newVaultShares = self.vaults[collateralType].updateCollateralValue();

        int debtChange = self.debtDist.updateActorShares(actorId, newVaultShares);

        // update totalLiquidity
        self.totalLiquidity += int128( 
            // change in liquidity value
            int(newVaultShares - oldVaultShares) -
                // change in vault debt
                debtChange
        );

        self.vaults[collateralType].distributeDebt(debtChange);

        distributeDebt(self);
    }

    function updateAccountDebt(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal returns (int) {
        recalculateVaultCollateral(self, collateralType);

        return self.vaults[collateralType].updateAccountDebt(accountId);
    }

    function resetVault(
        Data storage self,
        address collateralType
    ) internal {
        // inform the pool that this market is exiting (note the debt has already been rolled into vaultData so no change)
        self.debtDist.updateActorShares(bytes32(uint(uint160(collateralType))), 0);

        // reboot the vault
        self.vaults[collateralType].reset();
    }

    function currentVaultCollateralRatio(Data storage self, address collateralType) internal returns (uint) {
        recalculateVaultCollateral(self, collateralType);

        return self.vaults[collateralType].currentCollateralRatio();
    }

    function currentVaultDebt(Data storage self, address collateralType) internal returns (int) {
        recalculateVaultCollateral(self, collateralType);

        return self.vaults[collateralType].currentDebt();
    }

    function currentVaultCollateral(Data storage self, address collateralType) internal view
        returns (uint collateralAmount, uint collateralValue)
    {
        return self.vaults[collateralType].currentCollateral();
    }

    function currentAccountCollateral(
        Data storage self,
        address collateralType,
        uint128 accountId
    )
        internal view
        returns (
            uint collateralAmount,
            uint collateralValue,
            uint shares
        )
    {
        return self.vaults[collateralType].currentAccountCollateral(accountId);
    }

    function currentAccountCollateralizationRatio(
        Data storage self,
        address collateralType,
        uint128 accountId
    ) internal returns (uint) {
        (, uint getPositionCollateralValue, ) = currentAccountCollateral(self, collateralType, accountId);
        int getPositionDebt = updateAccountDebt(self, collateralType, accountId);

        // if they have a credit, just treat their debt as 0
        return getPositionCollateralValue.divDecimal(getPositionDebt < 0 ? 0 : uint(getPositionDebt));
    }
}
