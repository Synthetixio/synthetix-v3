//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

import "../../storage/DistributionEntry.sol";

import "../../storage/Account.sol";
import "../../storage/AccountRBAC.sol";
import "../../mixins/AccountMixin.sol";
import "../../storage/Pool.sol";

import "../../interfaces/IRewardsManagerModule.sol";

contract RewardsManagerModule is IRewardsManagerModule, OwnableMixin, AccountMixin, AssociatedSystemsMixin {
    using SetUtil for SetUtil.Bytes32Set;
    using MathUtil for uint256;

    using Vault for Vault.Data;
    using Distribution for Distribution.Data;
    using DistributionEntry for DistributionEntry.Data;

    error InvalidParameters(string incorrectParameter, string help);

    uint private constant _MAX_REWARD_DISTRIBUTIONS = 10;

    // ---------------------------------------
    // Associated Rewards
    // ---------------------------------------

    function setRewardsDistribution(
        uint128 poolId,
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

        Pool.Data storage pool = Pool.load(poolId);

        RewardDistribution.Data[] storage dists = pool.vaults[collateralType].rewards;

        if (index > dists.length) {
            revert InvalidParameters("index", "should be next index");
        } else if (index == dists.length) {
            dists.push(); // extend the size of the array by 1
        }

        RewardDistribution.Data storage existingDistribution = dists[index];

        // to call this function must be either:
        // 1. pool owner
        // 2. the registered distributor contract
        if (pool.owner != msg.sender && address(existingDistribution.distributor) != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        if (distributor == address(0)) {
            revert InvalidParameters("distributor", "must be non-zero");
        }

        existingDistribution.rewardPerShare += uint128(
            uint(
                existingDistribution.entry.distribute(
                    pool.vaults[collateralType].currentEpoch().debtDist,
                    int(amount),
                    start,
                    duration
                )
            )
        );

        existingDistribution.distributor = IRewardDistributor(distributor);

        emit RewardDistributed(poolId, collateralType, index, distributor, amount, start, duration);
    }

    function getAvailableRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId
    ) external override returns (uint[] memory) {
        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        return vault.updateAvailableRewards(accountId);
    }

    function getCurrentRewardAccumulation(uint128 poolId, address collateralType)
        external
        view
        override
        returns (uint[] memory)
    {
        return _getCurrentRewardAccumulation(poolId, collateralType);
    }

    function claimRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId
    ) external override onlyWithPermission(accountId, AccountRBAC._REWARDS_PERMISSION) returns (uint[] memory) {
        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        uint[] memory rewards = vault.updateAvailableRewards(accountId);

        for (uint i = 0; i < rewards.length; i++) {
            if (rewards[i] > 0) {
                // todo: reentrancy protection?
                vault.rewards[i].distributor.payout(poolId, collateralType, msg.sender, rewards[i]);
                vault.rewards[i].actorInfo[accountId].pendingSend = 0;
                emit RewardsClaimed(poolId, collateralType, accountId, i, rewards[i]);
            }
        }

        return rewards;
    }

    function _getCurrentRewardAccumulation(uint128 poolId, address collateralType) internal view returns (uint[] memory) {
        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        RewardDistribution.Data[] storage dists = vault.rewards;

        uint totalShares = vault.currentEpoch().debtDist.totalShares;

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
                uint(int(dists[i].entry.duration)).divDecimal(totalShares)
            );
        }

        return rates;
    }
}
