//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultEpoch.sol";
import "./RewardDistribution.sol";

import "./CollateralConfiguration.sol";

/**
 * @title Tracks collateral and debt distributions in a pool for a specific collateral type.
 *
 * I.e. if a pool supports SNX and ETH collaterals, it will have an SNX Vault, and an ETH Vault.
 *
 * The Vault data structure is itself split into VaultEpoch sub-data structures. This facilitates liquidations,
 * so that whenever a liquidation occurs, instead of having to traverse and reset all data, a new epoch can simply
 * be created, effectively wiping all data, whilst having a record of the data before the liquidation event.
 *
 * It is recommended to understand VaultEpoch before understanding this object.
 *
 * TODO
 */
library Vault {
    using VaultEpoch for VaultEpoch.Data;
    using Distribution for Distribution.Data;
    using DistributionEntry for DistributionEntry.Data;
    using MathUtil for uint256;

    struct Data {
        /**
         * @dev TODO
         *
         * If a Vault is fully liquidated, this will be incremented to indicate
         * shares being reset.
         */
        uint epoch;
        /**
         * @dev TODO
         */
        uint128 prevUsdWeight;
        /**
         * @dev TODO
         */
        uint128 prevRemainingLiquidity;
        /**
         * @dev Vault data for all the liquidation cycles divided into epochs.
         */
        mapping(uint => VaultEpoch.Data) epochData;
        /**
         * @dev TODO
         */
        RewardDistribution.Data[] rewards;
    }

    /**
     * @dev TODO
     */
    function currentEpoch(Data storage self) internal view returns (VaultEpoch.Data storage) {
        return self.epochData[self.epoch];
    }

    /**
     * @dev TODO
     *
     * Called by another function in Pool at entry point for ticker, sets the liquidity shares within the pool
     * Part of ticker chain
     *
     * Returns the amount of collateral that this vault is providing in net USD terms
     */
    function measureLiquidity(Data storage self, uint collateralPrice)
        internal
        returns (
            uint usdWeight,
            int deltaUsdWeight,
            uint remainingLiquidity,
            int deltaRemainingLiquidity
        )
    {
        VaultEpoch.Data storage epochData = currentEpoch(self);

        usdWeight = uint(epochData.incomingDebtDist.totalShares).mulDecimal(collateralPrice);

        int vaultDepositedValue = int(uint(epochData.collateralDist.totalValue()).mulDecimal(collateralPrice));
        int vaultAccruedDebt = epochData.totalDebt();
        remainingLiquidity = vaultDepositedValue > epochData.totalDebt() ? uint(vaultDepositedValue - vaultAccruedDebt) : 0;

        deltaUsdWeight = int(usdWeight) - int(int128(self.prevUsdWeight));
        deltaRemainingLiquidity = int(remainingLiquidity) - int(int128(self.prevRemainingLiquidity));

        self.prevUsdWeight = uint128(usdWeight);
        self.prevRemainingLiquidity = uint128(remainingLiquidity);
    }

    /**
     * @dev TODO
     */
    function distributeDebt(Data storage self, int debtChange) internal {
        currentEpoch(self).distributeDebt(debtChange);
    }

    /**
     * @dev TODO
     */
    function updateAccountDebt(Data storage self, uint128 accountId) internal returns (int) {
        return currentEpoch(self).updateAccountDebt(accountId);
    }

    /**
     * @dev TODO
     */
    function updateAvailableRewards(Data storage self, uint128 accountId) internal returns (uint[] memory) {
        uint totalShares = currentEpoch(self).incomingDebtDist.totalShares;
        uint actorShares = currentEpoch(self).incomingDebtDist.getActorShares(bytes32(uint(accountId)));

        uint[] memory rewards = new uint[](self.rewards.length);
        for (uint i = 0; i < rewards.length; i++) {
            RewardDistribution.Data storage dist = self.rewards[i];

            if (address(dist.distributor) == address(0)) {
                continue;
            }

            dist.rewardPerShare += uint128(dist.entry.updateEntry(totalShares));

            dist.actorInfo[accountId].pendingSend += uint128(
                (actorShares * (dist.rewardPerShare - dist.actorInfo[accountId].lastRewardPerShare)) / 1e18
            );

            dist.actorInfo[accountId].lastRewardPerShare = dist.rewardPerShare;

            rewards[i] = dist.actorInfo[accountId].pendingSend;
        }

        return rewards;
    }

    /**
     * @dev Increments the current epoch index, effectively target a
     * completely blank new VaultEpoch data structure.
     */
    function reset(Data storage self) internal {
        self.epoch++;
    }

    /**
     * @dev TODO
     */
    function currentDebt(Data storage self) internal view returns (int) {
        VaultEpoch.Data storage epochData = currentEpoch(self);

        return epochData.unconsolidatedDebt + epochData.consolidatedDebtDist.totalValue();
    }

    /**
     * @dev Returns the Vault's total collateral value in the current epoch.
     *
     * TODO
     */
    function currentCollateral(Data storage self) internal view returns (uint collateralAmount) {
        VaultEpoch.Data storage epochData = currentEpoch(self);

        collateralAmount = uint(epochData.collateralDist.totalValue());
    }

    /**
     * @dev TODO
     *
     * TODO: Semantic overloading here? It also returns debt, not only collateral.
     *
     * Probably very few use shares, so split out
     */
    function currentAccountCollateral(Data storage self, uint128 accountId)
        internal
        view
        returns (uint collateralAmount, uint shares)
    {
        collateralAmount = currentEpoch(self).getAccountCollateral(accountId);

        shares = currentEpoch(self).incomingDebtDist.totalShares;
    }
}
