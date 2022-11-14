//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultEpoch.sol";
import "./RewardDistribution.sol";

import "./CollateralConfiguration.sol";

/**
 * @title Tracks collateral and debt distributions in a pool, for a specific collateral type.
 *
 * I.e. if a pool supports SNX and ETH collaterals, it will have an SNX Vault, and an ETH Vault.
 *
 * The Vault data structure is itself split into VaultEpoch sub-structures. This facilitates liquidations,
 * so that whenever one occurs, a clean state of all data is achieved by simply incrementing the epoch index.
 *
 * It is recommended to understand VaultEpoch before understanding this object.
 */
library Vault {
    using VaultEpoch for VaultEpoch.Data;
    using Distribution for Distribution.Data;
    using DistributionEntry for DistributionEntry.Data;
    using MathUtil for uint256;
    using SetUtil for SetUtil.Bytes32Set;

    struct Data {
        /**
         * @dev The vault's current epoch number.
         *
         * Vault data is divided into epochs. An epoch changes when an entire vault is liquidated.
         */
        uint epoch;
        /**
         * @dev Unused property, maintained for backwards compatibility in storage layout.
         */
        uint128 unused_;
        /**
         * @dev The previous liquidity of the vault (collateral - debt), when the system was last interacted with.
         */
        uint128 prevRemainingLiquidity;
        /**
         * @dev Vault data for all the liquidation cycles divided into epochs.
         */
        mapping(uint => VaultEpoch.Data) epochData;
        /**
         * @dev Tracks available rewards, per user, for this vault.
         */
        mapping(bytes32 => RewardDistribution.Data) rewards;
        /**
         * @dev Tracks reward, ids, for this vault.
         */
        SetUtil.Bytes32Set rewardIds;
    }

    /**
     * @dev Return's the VaultEpoch data for the current epoch.
     */
    function currentEpoch(Data storage self) internal view returns (VaultEpoch.Data storage) {
        return self.epochData[self.epoch];
    }

    /**
     * @dev Updates the vault's liquidity as the value of its collateral minus its debt.
     *
     * Called as a ticker when users interact with pools, allowing pools to set
     * vaults' liquidity shares within the them.
     *
     * Returns the amount of collateral that this vault is providing in net USD terms.
     *
     * TODO: Consider renaming to updateCreditCapacity?
     */
    function updateLiquidity(Data storage self, uint collateralPrice)
        internal
        returns (
            uint usdWeight,
            uint remainingLiquidity,
            int deltaRemainingLiquidity
        )
    {
        VaultEpoch.Data storage epochData = currentEpoch(self);

        usdWeight = uint(epochData.incomingDebtDist.totalShares).mulDecimal(collateralPrice);

        int vaultDepositedValue = int(uint(epochData.collateralDist.totalValue()).mulDecimal(collateralPrice));
        int vaultAccruedDebt = epochData.totalDebt();
        remainingLiquidity = vaultDepositedValue > vaultAccruedDebt ? uint(vaultDepositedValue - vaultAccruedDebt) : 0;

        deltaRemainingLiquidity = int(remainingLiquidity) - int(int128(self.prevRemainingLiquidity));

        self.prevRemainingLiquidity = uint128(remainingLiquidity);
    }

    /**
     * @dev Updated the value per share of the current epoch's incoming debt distribution.
     */
    function distributeDebt(Data storage self, int debtChange) internal {
        currentEpoch(self).distributeDebt(debtChange);
    }

    /**
     * @dev Consolidates an accounts debt.
     */
    function consolidateAccountDebt(Data storage self, uint128 accountId) internal returns (int) {
        return currentEpoch(self).consolidateAccountDebt(accountId);
    }

    /**
     * @dev Traverses available rewards for this vault, and updates an accounts
     * claim on them according to the amount of debt shares they have.
     */
    function updateRewards(Data storage self, uint128 accountId) internal returns (uint[] memory, address[] memory) {
        uint[] memory rewards = new uint[](self.rewardIds.length());
        address[] memory distributors = new address[](self.rewardIds.length());
        for (uint i = 0; i < self.rewardIds.length(); i++) {
            RewardDistribution.Data storage dist = self.rewards[self.rewardIds.valueAt(i + 1)];

            if (address(dist.distributor) == address(0)) {
                continue;
            }

            rewards[i] = updateReward(self, accountId, self.rewardIds.valueAt(i + 1));
            distributors[i] = address(dist.distributor);
        }

        return (rewards, distributors);
    }

    /**
     * @dev Traverses available rewards for this vault and the reward id, and updates an accounts
     * claim on them according to the amount of debt shares they have.
     */
    function updateReward(
        Data storage self,
        uint128 accountId,
        bytes32 rewardId
    ) internal returns (uint) {
        uint totalShares = currentEpoch(self).incomingDebtDist.totalShares;
        uint actorShares = currentEpoch(self).incomingDebtDist.getActorShares(bytes32(uint(accountId)));

        RewardDistribution.Data storage dist = self.rewards[rewardId];

        if (address(dist.distributor) == address(0)) {
            revert("No distributor");
        }

        dist.rewardPerShare += uint128(dist.entry.updateEntry(totalShares));

        dist.actorInfo[accountId].pendingSend += uint128(
            (actorShares * (dist.rewardPerShare - dist.actorInfo[accountId].lastRewardPerShare)) / 1e18
        );

        dist.actorInfo[accountId].lastRewardPerShare = dist.rewardPerShare;

        return dist.actorInfo[accountId].pendingSend;
    }

    /**
     * @dev Increments the current epoch index, effectively producing a
     * completely blank new VaultEpoch data structure in the vault.
     */
    function reset(Data storage self) internal {
        self.epoch++;
    }

    /**
     * @dev Returns the vault's combined debt (consolidated and unconsolidated),
     * for the current epoch.
     */
    function currentDebt(Data storage self) internal view returns (int) {
        return currentEpoch(self).totalDebt();
    }

    /**
     * @dev Returns the total value in the Vault's collateral distribution, for the current epoch.
     */
    function currentCollateral(Data storage self) internal view returns (uint) {
        return uint(currentEpoch(self).collateralDist.totalValue());
    }

    /**
     * @dev Returns an account's collateral value in this vault's current epoch.
     */
    function currentAccountCollateral(Data storage self, uint128 accountId) internal view returns (uint) {
        return currentEpoch(self).getAccountCollateral(accountId);
    }
}
