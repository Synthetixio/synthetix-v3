//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultEpoch.sol";
import "./RewardDistribution.sol";

import "./CollateralConfiguration.sol";

library Vault {
    using VaultEpoch for VaultEpoch.Data;
    using Distribution for Distribution.Data;
    using DistributionEntry for DistributionEntry.Data;

    using MathUtil for uint256;

    struct Data {
        /// @dev if vault is fully liquidated, this will be incremented to indicate reset shares
        uint epoch;
        uint128 prevUsdWeight;
        uint128 prevRemainingLiquidity;
        /// @dev the data for all the different liquidation cycles
        mapping(uint => VaultEpoch.Data) epochData;
        /// @dev rewards
        RewardDistribution.Data[] rewards;
    }

    function currentEpoch(Data storage self) internal view returns (VaultEpoch.Data storage) {
        return self.epochData[self.epoch];
    }

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

        usdWeight = uint(epochData.debtDist.totalShares).mulDecimal(collateralPrice);

        int vaultDepositedValue = int(uint(epochData.collateralDist.totalValue()).mulDecimal(collateralPrice));
        int vaultAccruedDebt = epochData.totalDebt();
        remainingLiquidity = vaultDepositedValue > epochData.totalDebt() ? uint(vaultDepositedValue - vaultAccruedDebt) : 0;

        deltaUsdWeight = int(usdWeight) - int(int128(self.prevUsdWeight));
        deltaRemainingLiquidity = int(remainingLiquidity) - int(int128(self.prevRemainingLiquidity));

        self.prevUsdWeight = uint128(usdWeight);
        self.prevRemainingLiquidity = uint128(remainingLiquidity);
    }

    function distributeDebt(Data storage self, int debtChange) internal {
        currentEpoch(self).distributeDebt(debtChange);
    }

    function updateAccountDebt(Data storage self, uint128 accountId) internal returns (int) {
        return currentEpoch(self).updateAccountDebt(accountId);
    }

    function updateAvailableRewards(Data storage self, uint128 accountId) internal returns (uint[] memory) {
        uint totalShares = currentEpoch(self).debtDist.totalShares;
        uint actorShares = currentEpoch(self).debtDist.getActorShares(bytes32(uint(accountId)));

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

    function reset(Data storage self) internal {
        self.epoch++;
    }

    function currentDebt(Data storage self) internal view returns (int) {
        VaultEpoch.Data storage epochData = currentEpoch(self);
        return epochData.unclaimedDebt + epochData.usdDebtDist.totalValue();
    }

    function currentCollateral(Data storage self) internal view returns (uint collateralAmount) {
        VaultEpoch.Data storage epochData = currentEpoch(self);

        collateralAmount = uint(epochData.collateralDist.totalValue());
    }

    function currentAccountCollateral(Data storage self, uint128 accountId)
        internal
        view
        returns (uint collateralAmount, uint shares)
    {
        collateralAmount = currentEpoch(self).getAccountCollateral(accountId);

        shares = currentEpoch(self).debtDist.totalShares;
    }
}
