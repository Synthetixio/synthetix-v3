//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Flags} from "../utils/Flags.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {ILiquidationModule} from "../interfaces/ILiquidationModule.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {MarketUpdate} from "../storage/MarketUpdate.sol";
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";
import {KeeperCosts} from "../storage/KeeperCosts.sol";

/**
 * @title Module for liquidating accounts.
 * @dev See ILiquidationModule.
 */
contract LiquidationModule is ILiquidationModule, IMarketEvents {
    using DecimalMath for uint256;
    using SafeCastU256 for uint256;
    using SetUtil for SetUtil.UintSet;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using PerpsMarket for PerpsMarket.Data;
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using KeeperCosts for KeeperCosts.Data;

    /**
     * @inheritdoc ILiquidationModule
     */
    function liquidate(uint128 accountId) external override returns (uint256 liquidationReward) {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);

        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        if (!liquidatableAccounts.contains(accountId)) {
            (
                bool isEligible,
                int256 availableMargin,
                ,
                uint256 requiredMaintenaceMargin,
                uint256 expectedLiquidationReward
            ) = account.isEligibleForLiquidation(PerpsPrice.Tolerance.STRICT);

            if (isEligible) {
                (uint256 flagCost, uint256 seizedMarginValue) = account.flagForLiquidation();

                emit AccountFlaggedForLiquidation(
                    accountId,
                    availableMargin,
                    requiredMaintenaceMargin,
                    expectedLiquidationReward,
                    flagCost
                );

                liquidationReward = _liquidateAccount(account, flagCost, seizedMarginValue, true);
            } else {
                revert NotEligibleForLiquidation(accountId);
            }
        } else {
            liquidationReward = _liquidateAccount(account, 0, 0, false);
        }
    }

    function liquidateMarginOnly(
        uint128 accountId
    ) external override returns (uint256 liquidationReward) {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);
        // TODO: ensure no positions

        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        (bool isEligible, ) = account.isEligibleForMarginLiquidation(PerpsPrice.Tolerance.STRICT);
        if (isEligible) {
            // TODO: keeper flag rewards
            // TODO: send margin to liquidation rewards distributor
        } else {
            revert NotEligibleForMarginLiquidation(accountId);
        }
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function liquidateFlagged(
        uint256 maxNumberOfAccounts
    ) external override returns (uint256 liquidationReward) {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);

        uint256[] memory liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts
            .values();

        uint256 numberOfAccountsToLiquidate = MathUtil.min(
            maxNumberOfAccounts,
            liquidatableAccounts.length
        );

        for (uint256 i = 0; i < numberOfAccountsToLiquidate; i++) {
            uint128 accountId = liquidatableAccounts[i].to128();
            liquidationReward += _liquidateAccount(PerpsAccount.load(accountId), 0, 0, false);
        }
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function liquidateFlaggedAccounts(
        uint128[] calldata accountIds
    ) external override returns (uint256 liquidationReward) {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);

        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;

        for (uint256 i = 0; i < accountIds.length; i++) {
            uint128 accountId = accountIds[i];
            if (!liquidatableAccounts.contains(accountId)) {
                continue;
            }

            liquidationReward += _liquidateAccount(PerpsAccount.load(accountId), 0, 0, false);
        }
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function flaggedAccounts() external view override returns (uint256[] memory accountIds) {
        return GlobalPerpsMarket.load().liquidatableAccounts.values();
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function canLiquidate(uint128 accountId) external view override returns (bool isEligible) {
        (isEligible, , , , ) = PerpsAccount.load(accountId).isEligibleForLiquidation(
            PerpsPrice.Tolerance.DEFAULT
        );
    }

    /**
     * @inheritdoc ILiquidationModule
     */
    function liquidationCapacity(
        uint128 marketId
    )
        external
        view
        override
        returns (
            uint256 capacity,
            uint256 maxLiquidationInWindow,
            uint256 latestLiquidationTimestamp
        )
    {
        return
            PerpsMarket.load(marketId).currentLiquidationCapacity(
                PerpsMarketConfiguration.load(marketId)
            );
    }

    struct LiquidateAccountRuntime {
        uint128 accountId;
        uint256 totalFlaggingRewards;
        uint256 totalLiquidated;
        bool accountFullyLiquidated;
        uint256 totalLiquidationCost;
        uint256 price;
        uint128 positionMarketId;
        uint256 loopIterator; // stack too deep to the extreme
    }

    /**
     * @dev liquidates an account
     */
    function _liquidateAccount(
        PerpsAccount.Data storage account,
        uint256 costOfFlagExecution,
        uint256 totalCollateralValue,
        bool positionFlagged
    ) internal returns (uint256 keeperLiquidationReward) {
        LiquidateAccountRuntime memory runtime;
        runtime.accountId = account.id;
        uint256[] memory openPositionMarketIds = account.openPositionMarketIds.values();

        for (
            runtime.loopIterator = 0;
            runtime.loopIterator < openPositionMarketIds.length;
            runtime.loopIterator++
        ) {
            runtime.positionMarketId = openPositionMarketIds[runtime.loopIterator].to128();
            runtime.price = PerpsPrice.getCurrentPrice(
                runtime.positionMarketId,
                PerpsPrice.Tolerance.STRICT
            );

            (
                uint256 amountLiquidated,
                int128 newPositionSize,
                int128 sizeDelta,
                uint256 oldPositionAbsSize,
                MarketUpdate.Data memory marketUpdateData
            ) = account.liquidatePosition(runtime.positionMarketId, runtime.price);

            // endorsed liquidators do not get flag rewards
            if (
                ERC2771Context._msgSender() !=
                PerpsMarketConfiguration.load(runtime.positionMarketId).endorsedLiquidator
            ) {
                // using oldPositionAbsSize to calculate flag reward
                runtime.totalFlaggingRewards += PerpsMarketConfiguration
                    .load(runtime.positionMarketId)
                    .calculateFlagReward(oldPositionAbsSize.mulDecimal(runtime.price));
            }

            if (amountLiquidated == 0) {
                continue;
            }

            runtime.totalLiquidated += amountLiquidated;

            emit MarketUpdated(
                runtime.positionMarketId,
                runtime.price,
                marketUpdateData.skew,
                marketUpdateData.size,
                sizeDelta,
                marketUpdateData.currentFundingRate,
                marketUpdateData.currentFundingVelocity,
                marketUpdateData.interestRate
            );

            emit PositionLiquidated(
                runtime.accountId,
                runtime.positionMarketId,
                amountLiquidated,
                newPositionSize
            );
        }

        runtime.totalLiquidationCost =
            KeeperCosts.load().getLiquidateKeeperCosts() +
            costOfFlagExecution;
        if (positionFlagged || runtime.totalLiquidated > 0) {
            keeperLiquidationReward = _processLiquidationRewards(
                positionFlagged ? runtime.totalFlaggingRewards : 0,
                runtime.totalLiquidationCost,
                totalCollateralValue
            );
            runtime.accountFullyLiquidated = account.openPositionMarketIds.length() == 0;
            if (runtime.accountFullyLiquidated) {
                GlobalPerpsMarket.load().liquidatableAccounts.remove(runtime.accountId);
            }
        }

        emit AccountLiquidationAttempt(
            runtime.accountId,
            keeperLiquidationReward,
            runtime.accountFullyLiquidated
        );
    }

    /**
     * @dev process the accumulated liquidation rewards
     */
    function _processLiquidationRewards(
        uint256 keeperRewards,
        uint256 costOfExecutionInUsd,
        uint256 availableMarginInUsd
    ) private returns (uint256 reward) {
        if ((keeperRewards + costOfExecutionInUsd) == 0) {
            return 0;
        }
        // pay out liquidation rewards
        reward = GlobalPerpsMarketConfiguration.load().keeperReward(
            keeperRewards,
            costOfExecutionInUsd,
            availableMarginInUsd
        );
        if (reward > 0) {
            PerpsMarketFactory.load().withdrawMarketUsd(ERC2771Context._msgSender(), reward);
        }
    }
}
