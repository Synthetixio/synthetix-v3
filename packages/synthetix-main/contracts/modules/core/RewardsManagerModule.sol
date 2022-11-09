//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "../../storage/DistributionEntry.sol";

import "../../storage/Account.sol";
import "../../storage/AccountRBAC.sol";
import "../../storage/Pool.sol";

import "../../interfaces/IRewardsManagerModule.sol";

contract RewardsManagerModule is IRewardsManagerModule {
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

    function registerRewardsDistributor(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external override {
        Pool.Data storage pool = Pool.load(poolId);
        SetUtil.Bytes32Set storage rewardIds = pool.vaults[collateralType].rewardIds;

        if (pool.owner != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        if (rewardIds.length() > _MAX_REWARD_DISTRIBUTIONS) {
            revert InvalidParameters("index", "too large");
        }

        bytes32 rewardId = keccak256(abi.encode(poolId, collateralType, distributor));

        if (rewardIds.contains(rewardId)) {
            revert InvalidParameters("reward", "is already registered");
        }

        rewardIds.add(rewardId);
        if (distributor == address(0)) {
            revert InvalidParameters("distributor", "must be non-zero");
        }
        pool.vaults[collateralType].rewards[rewardId].distributor = IRewardDistributor(distributor);
    }

    function distributeRewards(
        uint128 poolId,
        address collateralType,
        uint amount,
        uint start,
        uint duration
    ) external override {
        Pool.Data storage pool = Pool.load(poolId);
        SetUtil.Bytes32Set storage rewardIds = pool.vaults[collateralType].rewardIds;
        // this function is called by the reward distributor
        bytes32 rewardId = keccak256(abi.encode(poolId, collateralType, msg.sender));

        if (!rewardIds.contains(rewardId)) {
            revert InvalidParameters("poolId-collateralType-distributor", "reward is not registered");
        }

        RewardDistribution.Data storage reward = pool.vaults[collateralType].rewards[rewardId];

        reward.rewardPerShare += uint128(
            uint(
                reward.entry.distribute(
                    pool.vaults[collateralType].currentEpoch().incomingDebtDist,
                    int(amount),
                    start,
                    duration
                )
            )
        );

        emit RewardsDistributed(poolId, collateralType, msg.sender, amount, start, duration);
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
    ) external override returns (uint[] memory) {
        Account.onlyWithPermission(accountId, AccountRBAC._REWARDS_PERMISSION);

        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        uint[] memory rewards = vault.updateAvailableRewards(accountId);
        SetUtil.Bytes32Set storage rewardIds = vault.rewardIds;

        for (uint i = 1; i <= rewards.length; i++) {
            if (rewards[i - 1] > 0) {
                // todo: reentrancy protection?
                vault.rewards[rewardIds.valueAt(i)].distributor.payout(
                    accountId,
                    poolId,
                    collateralType,
                    msg.sender,
                    rewards[i - 1]
                );
                vault.rewards[rewardIds.valueAt(i)].actorInfo[accountId].pendingSend = 0;
                emit RewardsClaimed(accountId, poolId, collateralType, i - 1, rewards[i - 1]);
            }
        }

        return rewards;
    }

    function _getCurrentRewardAccumulation(uint128 poolId, address collateralType) internal view returns (uint[] memory) {
        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        SetUtil.Bytes32Set storage rewardIds = vault.rewardIds;

        uint totalShares = vault.currentEpoch().incomingDebtDist.totalShares;

        int curTime = int(block.timestamp);

        uint[] memory rates = new uint[](rewardIds.length());

        for (uint i = 1; i <= rewardIds.length(); i++) {
            if (
                address(vault.rewards[rewardIds.valueAt(i)].distributor) == address(0) ||
                vault.rewards[rewardIds.valueAt(i)].entry.start > curTime ||
                vault.rewards[rewardIds.valueAt(i)].entry.start + vault.rewards[rewardIds.valueAt(i)].entry.duration <=
                curTime
            ) {
                continue;
            }

            rates[i - 1] = uint(int(vault.rewards[rewardIds.valueAt(i)].entry.scheduledValue)).divDecimal(
                uint(int(vault.rewards[rewardIds.valueAt(i)].entry.duration)).divDecimal(totalShares)
            );
        }

        return rates;
    }
}
