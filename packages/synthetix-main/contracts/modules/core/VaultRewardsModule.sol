//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";
import "../../mixins/AccountRBACMixin.sol";
import "../../mixins/FundMixin.sol";

import "../../utils/SharesLibrary.sol";

import "../../storage/FundVaultStorage.sol";
import "../../interfaces/IVaultRewardsModule.sol";

import "../../submodules/FundEventAndErrors.sol";

contract VaultRewardsModule is
    IVaultRewardsModule,
    FundVaultStorage,
    FundEventAndErrors,
    AccountRBACMixin,
    OwnableMixin,
    AssociatedSystemsMixin,
    FundMixin
{
    using SetUtil for SetUtil.Bytes32Set;
    using MathUtil for uint256;

    using SharesLibrary for SharesLibrary.Distribution;

    uint private constant _MAX_REWARD_DISTRIBUTIONS = 10;

    // ---------------------------------------
    // Associated Rewards
    // ---------------------------------------

    function distributeRewards(
        uint fundId,
        address collateralType,
        uint index,
        address distributor,
        uint amount,
        uint start,
        uint duration
    ) external override {
        if (index > _MAX_REWARD_DISTRIBUTIONS) {
            revert InvalidParameters("index", "too large");
        }

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        RewardDistribution[] storage dists = vaultData.rewards;

        if (index > dists.length) {
            revert InvalidParameters("index", "should be next index");
        } else if (index == dists.length) {
            dists.push(); // extend the size of the array by 1
        }

        RewardDistribution storage existingDistribution = dists[index];

        // to call this function must be either:
        // 1. fund owner
        // 2. the registered distributor contract
        if (_ownerOf(fundId) != msg.sender && address(existingDistribution.distributor) != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        if ((_ownerOf(fundId) != msg.sender && distributor != msg.sender) || distributor == address(0)) {
            revert InvalidParameters("distributor", "must be non-zero");
        }

        existingDistribution.rewardPerShare += uint128(
            uint(epochData.debtDist.distributeWithEntry(existingDistribution.entry, int(amount), start, duration))
        );

        existingDistribution.distributor = IRewardDistributor(distributor);

        emit RewardDistributionSet(fundId, collateralType, index, distributor, amount, start, duration);
    }

    function getAvailableRewards(
        uint fundId,
        address collateralType,
        uint accountId
    ) external override returns (uint[] memory) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];
        return _updateAvailableRewards(epochData, vaultData.rewards, accountId);
    }

    function getCurrentRewardAccumulation(uint fundId, address collateralType)
        external
        view
        override
        returns (uint[] memory)
    {
        return _getCurrentRewardAccumulation(fundId, collateralType);
    }

    function claimRewards(
        uint fundId,
        address collateralType,
        uint accountId
    ) external override returns (uint[] memory) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];
        uint[] memory rewards = _updateAvailableRewards(epochData, vaultData.rewards, accountId);

        for (uint i = 0; i < rewards.length; i++) {
            if (rewards[i] > 0) {
                // todo: reentrancy protection?
                vaultData.rewards[i].distributor.payout(fundId, collateralType, msg.sender, rewards[i]);
                vaultData.rewards[i].actorInfo[accountId].pendingSend = 0;
                emit RewardsClaimed(fundId, collateralType, accountId, i, rewards[i]);
            }
        }

        return rewards;
    }

    function _getCurrentRewardAccumulation(uint fundId, address collateralType) internal view returns (uint[] memory) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];
        RewardDistribution[] storage dists = vaultData.rewards;

        int curTime = int(block.timestamp);

        uint[] memory rates = new uint[](dists.length);

        for (uint i = 0; i < dists.length; i++) {
            if (
                address(dists[i].distributor) == address(0) ||
                dists[i].entry.start > curTime ||
                dists[i].entry.start + dists[i].entry.duration <= curTime
            ) {
                continue;
            }

            rates[i] = uint(int(dists[i].entry.scheduledValue)).divDecimal(
                uint(int(dists[i].entry.duration)).divDecimal(epochData.debtDist.totalShares)
            );
        }

        return rates;
    }
}
