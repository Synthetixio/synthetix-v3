//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

import "../../storage/Account.sol";
import "../../storage/AccountRBAC.sol";
import "../../storage/Pool.sol";

import "../../interfaces/IRewardsManagerModule.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

/**
 * @title Module for connecting rewards distributors to vaults.
 * @dev See IRewardsManagerModule.
 */
contract RewardsManagerModule is IRewardsManagerModule {
    using SetUtil for SetUtil.Bytes32Set;
    using DecimalMath for uint256;
    using DecimalMath for int256;
    using SafeCastU32 for uint32;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;

    using Vault for Vault.Data;
    using Distribution for Distribution.Data;
    using RewardDistribution for RewardDistribution.Data;

    uint256 private constant _MAX_REWARD_DISTRIBUTIONS = 10;

    bytes32 private constant _CLAIM_FEATURE_FLAG = "claimRewards";

    /**
     * @inheritdoc IRewardsManagerModule
     */
    function registerRewardsDistributor(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external override {
        Pool.Data storage pool = Pool.load(poolId);
        SetUtil.Bytes32Set storage rewardIds = pool.vaults[collateralType].rewardIds;

        if (pool.owner != ERC2771Context._msgSender()) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        // Limit the maximum amount of rewards distributors can be connected to each vault to prevent excessive gas usage on other calls
        if (rewardIds.length() > _MAX_REWARD_DISTRIBUTIONS) {
            revert ParameterError.InvalidParameter("index", "too large");
        }

        if (
            !ERC165Helper.safeSupportsInterface(distributor, type(IRewardDistributor).interfaceId)
        ) {
            revert ParameterError.InvalidParameter("distributor", "invalid interface");
        }

        bytes32 rewardId = _getRewardId(poolId, collateralType, distributor);

        if (rewardIds.contains(rewardId)) {
            revert ParameterError.InvalidParameter("distributor", "is already registered");
        }
        if (address(pool.vaults[collateralType].rewards[rewardId].distributor) != address(0)) {
            revert ParameterError.InvalidParameter("distributor", "cant be re-registered");
        }

        rewardIds.add(rewardId);
        if (distributor == address(0)) {
            revert ParameterError.InvalidParameter("distributor", "must be non-zero");
        }
        pool.vaults[collateralType].rewards[rewardId].distributor = IRewardDistributor(distributor);

        emit RewardsDistributorRegistered(poolId, collateralType, distributor);
    }

    /**
     * @inheritdoc IRewardsManagerModule
     */
    function distributeRewards(
        uint128 poolId,
        address collateralType,
        uint256 amount,
        uint64 start,
        uint32 duration
    ) external override {
        _distributeRewards(
            poolId,
            collateralType,
            ERC2771Context._msgSender(),
            amount,
            start,
            duration
        );
    }

    function distributeRewardsByOwner(
        uint128 poolId,
        address collateralType,
        address rewardsDistributor,
        uint256 amount,
        uint64 start,
        uint32 duration
    ) external override {
        Pool.Data storage pool = Pool.load(poolId);
        if (pool.owner != ERC2771Context._msgSender()) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        _distributeRewards(poolId, collateralType, rewardsDistributor, amount, start, duration);
    }

    /**
     * @inheritdoc IRewardsManagerModule
     */
    function updateRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId
    ) external override returns (uint256[] memory, address[] memory) {
        Account.exists(accountId);
        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        return vault.updateRewards(accountId, poolId, collateralType);
    }

    /**
     * @inheritdoc IRewardsManagerModule
     */
    function getRewardRate(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external view override returns (uint256) {
        return _getRewardRate(poolId, collateralType, distributor);
    }

    /**
     * @inheritdoc IRewardsManagerModule
     */
    function getAvailableRewards(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        address distributor
    ) external view returns (uint256) {
        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        bytes32 rewardId = _getRewardId(poolId, collateralType, distributor);

        if (address(vault.rewards[rewardId].distributor) != distributor) {
            revert ParameterError.InvalidParameter("invalid-params", "reward is not found");
        }

        return vault.getReward(accountId, rewardId);
    }

    /**
     * @inheritdoc IRewardsManagerModule
     */
    function claimRewards(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        address distributor
    ) external override returns (uint256) {
        FeatureFlag.ensureAccessToFeature(_CLAIM_FEATURE_FLAG);
        Account.loadAccountAndValidatePermission(accountId, AccountRBAC._REWARDS_PERMISSION);

        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        bytes32 rewardId = _getRewardId(poolId, collateralType, distributor);

        if (address(vault.rewards[rewardId].distributor) != distributor) {
            revert ParameterError.InvalidParameter("invalid-params", "reward is not found");
        }

        uint256 totalSharesD18 = vault.currentEpoch().accountsDebtDistribution.totalSharesD18;
        uint256 actorSharesD18 = vault.currentEpoch().accountsDebtDistribution.getActorShares(
            accountId.toBytes32()
        );

        uint256 rewardAmount = vault.updateReward(
            Vault.PositionSelector(accountId, poolId, collateralType),
            rewardId,
            totalSharesD18,
            actorSharesD18
        );

        RewardDistribution.Data storage reward = vault.rewards[rewardId];
        reward.claimStatus[accountId].pendingSendD18 = 0;
        bool success = vault.rewards[rewardId].distributor.payout(
            accountId,
            poolId,
            collateralType,
            ERC2771Context._msgSender(),
            rewardAmount
        );

        if (!success) {
            revert RewardUnavailable(distributor);
        }

        emit RewardsClaimed(
            accountId,
            poolId,
            collateralType,
            address(vault.rewards[rewardId].distributor),
            rewardAmount
        );

        return rewardAmount;
    }

    function _distributeRewards(
        uint128 poolId,
        address collateralType,
        address rewardsDistributor,
        uint256 amount,
        uint64 start,
        uint32 duration
    ) internal {
        Pool.Data storage pool = Pool.load(poolId);
        SetUtil.Bytes32Set storage rewardIds = pool.vaults[collateralType].rewardIds;

        // Identify the reward id for the caller, and revert if it is not a registered reward distributor.
        bytes32 rewardId = _getRewardId(poolId, collateralType, rewardsDistributor);
        if (!rewardIds.contains(rewardId)) {
            revert ParameterError.InvalidParameter(
                "poolId-collateralType-distributor",
                "reward is not registered"
            );
        }

        RewardDistribution.Data storage reward = pool.vaults[collateralType].rewards[rewardId];

        reward.rewardPerShareD18 += reward
            .distribute(
                pool.vaults[collateralType].currentEpoch().accountsDebtDistribution,
                amount.toInt(),
                start,
                duration
            )
            .toUint()
            .to128();

        emit RewardsDistributed(
            poolId,
            collateralType,
            ERC2771Context._msgSender(),
            amount,
            start,
            duration
        );
    }

    /**
     * @dev Return the amount of rewards being distributed to a vault per second
     */
    function _getRewardRate(
        uint128 poolId,
        address collateralType,
        address distributor
    ) internal view returns (uint256) {
        Vault.Data storage vault = Pool.load(poolId).vaults[collateralType];
        uint256 totalShares = vault.currentEpoch().accountsDebtDistribution.totalSharesD18;
        bytes32 rewardId = _getRewardId(poolId, collateralType, distributor);

        int256 curTime = block.timestamp.toInt();

        // No rewards are currently being distributed if the distributor doesn't exist, they are scheduled to be distributed in the future, or the distribution as already completed
        if (
            address(vault.rewards[rewardId].distributor) == address(0) ||
            vault.rewards[rewardId].start > curTime.toUint() ||
            vault.rewards[rewardId].start + vault.rewards[rewardId].duration <= curTime.toUint()
        ) {
            return 0;
        }

        return
            vault.rewards[rewardId].scheduledValueD18.to256().toUint().divDecimal(
                vault.rewards[rewardId].duration.to256().divDecimal(totalShares)
            );
    }

    /**
     * @dev Generate an ID for a rewards distributor connection by hashing its address with the vault's collateral type address and pool id
     */
    function _getRewardId(
        uint128 poolId,
        address collateralType,
        address distributor
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(poolId, collateralType, distributor));
    }

    /**
     * @inheritdoc IRewardsManagerModule
     */
    function removeRewardsDistributor(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external override {
        Pool.Data storage pool = Pool.load(poolId);
        SetUtil.Bytes32Set storage rewardIds = pool.vaults[collateralType].rewardIds;

        if (pool.owner != ERC2771Context._msgSender()) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        bytes32 rewardId = _getRewardId(poolId, collateralType, distributor);

        if (!rewardIds.contains(rewardId)) {
            revert ParameterError.InvalidParameter("distributor", "is not registered");
        }

        rewardIds.remove(rewardId);

        RewardDistribution.Data storage reward = pool.vaults[collateralType].rewards[rewardId];

        // ensure rewards emission is stopped (users can still come in to claim rewards after the fact)
        reward.rewardPerShareD18 += reward
            .distribute(
                pool.vaults[collateralType].currentEpoch().accountsDebtDistribution,
                0,
                0,
                0
            )
            .toUint()
            .to128();

        emit RewardsDistributorRemoved(poolId, collateralType, distributor);
    }
}
