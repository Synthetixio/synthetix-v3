//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./VaultEpoch.sol";
import "./RewardDistribution.sol";

import "./CollateralConfiguration.sol";

library Vault {
    using CollateralConfiguration for CollateralConfiguration.Data;
    using VaultEpoch for VaultEpoch.Data;
    using Distribution for Distribution.Data;
    using DistributionEntry for DistributionEntry.Data;

    using MathUtil for uint256;

    struct Data {
        /// @dev the collateral type this vault corresponds to
        address collateralType;

        /// @dev if vault is fully liquidated, this will be incremented to indicate reset shares
        uint epoch;
        /// @dev cached collateral price
        uint128 collateralPrice;
        /// @dev the data for all the different liquidation cycles
        mapping(uint => VaultEpoch.Data) epochData;
        /// @dev rewards
        RewardDistribution.Data[] rewards;
    }

    function currentEpoch(Data storage self) internal view returns (VaultEpoch.Data storage) {
        return self.epochData[self.epoch];
    }

    function updateCollateralValue(Data storage self) internal returns (uint) {
        VaultEpoch.Data storage epochData = currentEpoch(self);

        uint collateralPrice = CollateralConfiguration.load(self.collateralType).getCollateralValue();

        uint liquidityMultiplier = epochData.liquidityMultiplier;

        if (liquidityMultiplier == 0) {
            liquidityMultiplier = MathUtil.UNIT;
            epochData.liquidityMultiplier = uint128(liquidityMultiplier);
        }

        self.collateralPrice = uint128(collateralPrice);

        return uint(epochData.debtDist.totalShares).mulDecimal(collateralPrice).mulDecimal(liquidityMultiplier);
    }

    function distributeDebt(Data storage self, int debtChange) internal {
        currentEpoch(self).distributeDebt(debtChange);
    }

    function updateAccountDebt(Data storage self, uint128 accountId) internal returns (int) {
        return currentEpoch(self).updateAccountDebt(accountId);
    }

    function updateAvailableRewards(
        Data storage self,
        uint128 accountId
    ) internal returns (uint[] memory) {
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

    function clearAccount(Data storage self, uint128 accountId) internal {
        // need to do this before modifying any actor information
        updateAvailableRewards(self, accountId);

        // take away all the user's shares. by not giving the user back their portion of collateral, it will be
        // auto split proportionally between all debt holders
        currentEpoch(self).clearAccount(accountId);
    }

    function reset(Data storage self) internal {
        self.epoch++;
    }

    function currentCollateralRatio(Data storage self) internal view returns (uint) {
        (, uint collateralValue) = currentCollateral(self);

        int debt = currentDebt(self);

        // if they have a credit, just treat their debt as 0
        return debt <= 0 ? 0 : collateralValue.divDecimal(uint(debt));
    }

    function currentDebt(Data storage self) internal view returns (int) {
        VaultEpoch.Data storage epochData = currentEpoch(self);
        return epochData.unclaimedDebt + epochData.usdDebtDist.totalValue();
    }

    function currentCollateral(Data storage self)
        internal
        view
        returns (uint collateralAmount, uint collateralValue)
    {
        VaultEpoch.Data storage epochData = currentEpoch(self);

        collateralAmount = uint(epochData.collateralDist.totalValue());
        collateralValue = CollateralConfiguration.load(self.collateralType).getCollateralValue();
    }

    function currentAccountCollateral(Data storage self, uint128 accountId) internal view
        returns (
            uint collateralAmount,
            uint collateralValue,
            uint shares
        ) {
        collateralAmount = currentEpoch(self).getAccountCollateral(accountId);
        collateralValue = uint(self.collateralPrice).mulDecimal(collateralAmount);

        shares = currentEpoch(self).debtDist.totalShares;
    }
}
