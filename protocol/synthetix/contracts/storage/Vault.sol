//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./VaultEpoch.sol";
import "./RewardDistribution.sol";

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

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
    using RewardDistribution for RewardDistribution.Data;
    using ScalableMapping for ScalableMapping.Data;
    using DecimalMath for uint256;
    using DecimalMath for int128;
    using DecimalMath for int256;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;
    using SetUtil for SetUtil.Bytes32Set;

    /**
     * @dev Thrown when a non-existent reward distributor is referenced
     */
    error RewardDistributorNotFound();

    struct Data {
        /**
         * @dev The vault's current epoch number.
         *
         * Vault data is divided into epochs. An epoch changes when an entire vault is liquidated.
         */
        uint256 epoch;
        /**
         * @dev Unused property, maintained for backwards compatibility in storage layout.
         */
        // solhint-disable-next-line private-vars-leading-underscore
        bytes32 __slotAvailableForFutureUse;
        /**
         * @dev The previous debt of the vault, when `updateCreditCapacity` was last called by the Pool.
         */
        // solhint-disable-next-line var-name-mixedcase
        int128 _unused_prevTotalDebtD18;
        /**
         * @dev Vault data for all the liquidation cycles divided into epochs.
         */
        mapping(uint256 => VaultEpoch.Data) epochData;
        /**
         * @dev Tracks available rewards, per user, for this vault.
         */
        mapping(bytes32 => RewardDistribution.Data) rewards;
        /**
         * @dev Tracks reward ids, for this vault.
         */
        SetUtil.Bytes32Set rewardIds;
    }

    struct PositionSelector {
        uint128 accountId;
        uint128 poolId;
        address collateralType;
    }

    /**
     * @dev Return's the VaultEpoch data for the current epoch.
     */
    function currentEpoch(Data storage self) internal view returns (VaultEpoch.Data storage) {
        return self.epochData[self.epoch];
    }

    /**
     * @dev Updates the vault's credit capacity as the value of its collateral minus its debt.
     *
     * Called as a ticker when users interact with pools, allowing pools to set
     * vaults' credit capacity shares within them.
     *
     * Returns the amount of collateral that this vault is providing in net USD terms.
     */
    function updateCreditCapacity(
        Data storage self,
        uint256 collateralPriceD18
    ) internal view returns (uint256 usdWeightD18, int256 totalDebtD18) {
        VaultEpoch.Data storage epochData = currentEpoch(self);

        usdWeightD18 = (epochData.collateralAmounts.totalAmount()).mulDecimal(collateralPriceD18);

        totalDebtD18 = epochData.totalDebt();

        //self.prevTotalDebtD18 = totalDebtD18.to128();
    }

    /**
     * @dev Updated the value per share of the current epoch's incoming debt distribution.
     */
    function distributeDebtToAccounts(Data storage self, int256 debtChangeD18) internal {
        currentEpoch(self).distributeDebtToAccounts(debtChangeD18);
    }

    /**
     * @dev Consolidates an accounts debt.
     */
    function consolidateAccountDebt(
        Data storage self,
        uint128 accountId
    ) internal returns (int256) {
        return currentEpoch(self).consolidateAccountDebt(accountId);
    }

    function updateRewards(
        Data storage self,
        PositionSelector memory pos,
        bytes32[] memory rewardIds
    ) internal returns (uint256[] memory rewards, address[] memory distributors) {
        uint256 totalSharesD18 = currentEpoch(self).accountsDebtDistribution.totalSharesD18;
        uint256 actorSharesD18 = currentEpoch(self).accountsDebtDistribution.getActorShares(
            pos.accountId.toBytes32()
        );

        return updateRewards(self, pos, rewardIds, totalSharesD18, actorSharesD18);
    }

    /**
     * @dev Traverses available rewards for this vault, and updates an accounts
     * claim on them according to the amount of debt shares they have.
     */
    function updateRewards(
        Data storage self,
        PositionSelector memory pos,
        bytes32[] memory rewardIds,
        uint256 totalSharesD18,
        uint256 actorSharesD18
    ) internal returns (uint256[] memory rewards, address[] memory distributors) {
        rewards = new uint256[](rewardIds.length);
        distributors = new address[](rewardIds.length);

        for (uint256 i = 0; i < rewardIds.length; i++) {
            // gaps can exist in the rewardIds
            if (rewardIds[i] == 0) {
                continue;
            }

            RewardDistribution.Data storage dist = self.rewards[rewardIds[i]];

            address distributorAddress = address(dist.distributor);
            if (distributorAddress == address(0)) {
                continue;
            }

            distributors[i] = distributorAddress;
            rewards[i] = updateReward(
                self,
                pos,
                rewardIds[i],
                distributorAddress,
                totalSharesD18,
                actorSharesD18
            );
        }
    }

    /**
     * @dev Traverses available rewards for this vault and the reward id, and updates an accounts
     * claim on them according to the amount of debt shares they have.
     */
    function updateReward(
        Data storage self,
        PositionSelector memory pos,
        bytes32 rewardId,
        address distributor,
        uint256 totalSharesD18,
        uint256 actorSharesD18
    ) internal returns (uint256) {
        RewardDistribution.Data storage dist = self.rewards[rewardId];

        IRewardDistributor(distributor).onPositionUpdated(
            pos.accountId,
            pos.poolId,
            pos.collateralType,
            actorSharesD18
        );

        dist.rewardPerShareD18 += dist.updateEntry(totalSharesD18).toUint().to128();

        dist.claimStatus[pos.accountId].pendingSendD18 += actorSharesD18
            .mulDecimal(
                dist.rewardPerShareD18 - dist.claimStatus[pos.accountId].lastRewardPerShareD18
            )
            .to128();

        dist.claimStatus[pos.accountId].lastRewardPerShareD18 = dist.rewardPerShareD18;

        return dist.claimStatus[pos.accountId].pendingSendD18;
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
    function currentDebt(Data storage self) internal view returns (int256) {
        return currentEpoch(self).totalDebt();
    }

    /**
     * @dev Returns the total value in the Vault's collateral distribution, for the current epoch.
     */
    function currentCollateral(Data storage self) internal view returns (uint256) {
        return currentEpoch(self).collateralAmounts.totalAmount();
    }

    /**
     * @dev Returns an account's collateral value in this vault's current epoch.
     */
    function currentAccountCollateral(
        Data storage self,
        uint128 accountId
    ) internal view returns (uint256) {
        return currentEpoch(self).getAccountCollateral(accountId);
    }
}
