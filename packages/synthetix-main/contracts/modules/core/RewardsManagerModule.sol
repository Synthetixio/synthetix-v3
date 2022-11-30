//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

import "../../storage/DistributionEntry.sol";

import "../../storage/Account.sol";
import "../../storage/AccountRBAC.sol";
import "../../storage/Pool.sol";

import "../../interfaces/IRewardsManagerModule.sol";

contract RewardsManagerModule is IRewardsManagerModule {
    using SetUtil for SetUtil.Bytes32Set;
    using DecimalMath for uint256;

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

        bytes32 rewardId = _getRewardId(poolId, collateralType, distributor);

        if (rewardIds.contains(rewardId)) {
            revert InvalidParameters("distributor", "is already registered");
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
        bytes32 rewardId = _getRewardId(poolId, collateralType, msg.sender);

        if (!rewardIds.contains(rewardId)) {
            revert InvalidParameters("poolId-collateralType-distributor", "reward is not registered");
        }

        RewardDistribution.Data storage reward = pool.vaults[collateralType].rewards[rewardId];

        reward.rewardPerShareD18 += uint128(
            uint(
                reward.entry.distribute(
                    pool.vaults[collateralType].currentEpoch().accountsDebtDistribution,
                    int(amount),
                    start,
                    duration
                )
            )
        );

        emit RewardsDistributed(poolId, collateralType, msg.sender, amount, start, duration);
    }

    function getRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId
    ) external override returns (uint[] memory, address[] memory) {
        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        return vault.updateRewards(accountId);
    }

    function getRewardRate(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external view override returns (uint) {
        return _getRewardRate(poolId, collateralType, distributor);
    }

    function claimRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        address distributor
    ) external override returns (uint) {
        Account.onlyWithPermission(accountId, AccountRBAC._REWARDS_PERMISSION);

        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        bytes32 rewardId = keccak256(abi.encode(poolId, collateralType, distributor));

        if (!vault.rewardIds.contains(rewardId)) {
            revert InvalidParameters("invalid-params", "reward is not found");
        }

        uint reward = vault.updateReward(accountId, rewardId);

        vault.rewards[rewardId].distributor.payout(accountId, poolId, collateralType, msg.sender, reward);
        vault.rewards[rewardId].actorInfo[accountId].pendingSend = 0;
        emit RewardsClaimed(accountId, poolId, collateralType, address(vault.rewards[rewardId].distributor), reward);

        return reward;
    }

    function _getRewardRate(
        uint128 poolId,
        address collateralType,
        address distributor
    ) internal view returns (uint) {
        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        uint totalShares = vault.currentEpoch().accountsDebtDistribution.totalSharesD18;
        bytes32 rewardId = _getRewardId(poolId, collateralType, distributor);

        int curTime = int(block.timestamp);

        if (
            address(vault.rewards[rewardId].distributor) == address(0) ||
            vault.rewards[rewardId].entry.start > curTime ||
            vault.rewards[rewardId].entry.start + vault.rewards[rewardId].entry.duration <= curTime
        ) {
            return 0;
        }

        return
            uint(int(vault.rewards[rewardId].entry.scheduledValueD18)).divDecimal(
                uint(int(vault.rewards[rewardId].entry.duration)).divDecimal(totalShares)
            );
    }

    function _getRewardId(
        uint128 poolId,
        address collateralType,
        address distributor
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(poolId, collateralType, distributor));
    }
}
