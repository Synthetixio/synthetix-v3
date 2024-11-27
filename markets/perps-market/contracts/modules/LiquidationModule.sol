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
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {Position} from "../storage/Position.sol";

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
    using AsyncOrder for AsyncOrder.Data;

    /**
     * @inheritdoc ILiquidationModule
     */
    function liquidate(uint128 accountId) external override returns (uint256 liquidationReward) {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);

        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        PerpsAccount.MemoryContext memory ctx = account
            .getOpenPositionsAndCurrentPrices(PerpsPrice.Tolerance.STRICT);
        if (!liquidatableAccounts.contains(accountId)) {
            (
                uint256 totalCollateralValueWithDiscount,
                uint256 totalCollateralValueWithoutDiscount
            ) = account.getTotalCollateralValue(PerpsPrice.Tolerance.STRICT);

            (
                bool isEligible,
                int256 availableMargin,
                ,
                uint256 requiredMaintenaceMargin,
                uint256 expectedLiquidationReward
            ) = PerpsAccount.isEligibleForLiquidation(
                    ctx,
                    totalCollateralValueWithDiscount,
                    totalCollateralValueWithoutDiscount
                );

            if (isEligible) {
                (uint256 flagCost, uint256 seizedMarginValue) = account.flagForLiquidation();

                emit AccountFlaggedForLiquidation(
                    accountId,
                    availableMargin,
                    requiredMaintenaceMargin,
                    expectedLiquidationReward,
                    flagCost
                );

                liquidationReward = _liquidateAccount(ctx, flagCost, seizedMarginValue, true);
            } else {
                revert NotEligibleForLiquidation(accountId);
            }
        } else {
            liquidationReward = _liquidateAccount(ctx, 0, 0, false);
        }
    }

    function liquidateMarginOnly(
        uint128 accountId
    ) external override returns (uint256 liquidationReward) {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);

        PerpsAccount.Data storage account = PerpsAccount.load(accountId);

        if (account.hasOpenPositions()) {
            revert AccountHasOpenPositions(accountId);
        }

        PerpsAccount.MemoryContext memory ctx = account
            .getOpenPositionsAndCurrentPrices(PerpsPrice.Tolerance.STRICT);
        (
            uint256 totalCollateralValueWithDiscount,
            uint256 totalCollateralValueWithoutDiscount
        ) = account.getTotalCollateralValue(PerpsPrice.Tolerance.STRICT);
        (bool isEligible, ) = PerpsAccount.isEligibleForMarginLiquidation(
            ctx,
            totalCollateralValueWithDiscount,
            totalCollateralValueWithoutDiscount
        );
        if (isEligible) {
            // margin is sent to liquidation rewards distributor in getMarginLiquidationCostAndSeizeMargin
            uint256 marginLiquidateCost = KeeperCosts.load().getFlagKeeperCosts(account.id);
            uint256 seizedMarginValue = account.seizeCollateral();

            // keeper is rewarded in _liquidateAccount
            liquidationReward = _liquidateAccount(
                ctx,
                marginLiquidateCost,
                seizedMarginValue,
                true
            );
            // clear debt
            account.updateAccountDebt(-(account.debt.toInt()));

            // clean pending orders
            AsyncOrder.load(accountId).reset();

            emit AccountMarginLiquidation(accountId, seizedMarginValue, liquidationReward);
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
            liquidationReward += _liquidateAccount(PerpsAccount.load(accountId).getOpenPositionsAndCurrentPrices(PerpsPrice.Tolerance.STRICT), 0, 0, false);
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

            liquidationReward += _liquidateAccount(PerpsAccount.load(accountId).getOpenPositionsAndCurrentPrices(PerpsPrice.Tolerance.STRICT), 0, 0, false);
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
        // If an account is already flagged can be liquidated, no matter other conditions
        if (GlobalPerpsMarket.load().liquidatableAccounts.contains(accountId)) {
            return true;
        }

        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        PerpsAccount.MemoryContext memory ctx = account
            .getOpenPositionsAndCurrentPrices(PerpsPrice.Tolerance.DEFAULT);
        (
            uint256 totalCollateralValueWithDiscount,
            uint256 totalCollateralValueWithoutDiscount
        ) = account.getTotalCollateralValue(PerpsPrice.Tolerance.DEFAULT);
        (isEligible, , , , ) = PerpsAccount.isEligibleForLiquidation(
            ctx,
            totalCollateralValueWithDiscount,
            totalCollateralValueWithoutDiscount
        );
    }

    function canLiquidateMarginOnly(
        uint128 accountId
    ) external view override returns (bool isEligible) {
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        if (account.hasOpenPositions()) {
            return false;
        } else {
            PerpsAccount.MemoryContext memory ctx = account
                .getOpenPositionsAndCurrentPrices(PerpsPrice.Tolerance.DEFAULT);
            (
                uint256 totalCollateralValueWithDiscount,
                uint256 totalCollateralValueWithoutDiscount
            ) = account.getTotalCollateralValue(PerpsPrice.Tolerance.DEFAULT);
            (isEligible, ) = PerpsAccount.isEligibleForMarginLiquidation(
                ctx,
                totalCollateralValueWithDiscount,
                totalCollateralValueWithoutDiscount
            );
        }
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

    /**
     * @dev liquidates an account
     */
    function _liquidateAccount(
        PerpsAccount.MemoryContext memory ctx,
        uint256 costOfFlagExecution,
        uint256 totalCollateralValue,
        bool positionFlagged
    ) internal returns (uint256 keeperLiquidationReward) {

        //PerpsAccount.MemoryContext memory ctx = account
        //    .getOpenPositionsAndCurrentPrices(PerpsPrice.Tolerance.STRICT);

        uint256 i;
        uint256 totalLiquidated;
        for (i = 0;i < ctx.positions.length;i++) {
            (
                uint256 amountLiquidated,
                int128 newPositionSize,
                MarketUpdate.Data memory marketUpdateData
            ) = PerpsAccount.load(ctx.accountId).liquidatePosition(ctx.positions[i], ctx.prices[i]);

            if (amountLiquidated == 0) {
                continue;
            }

            totalLiquidated += amountLiquidated;

            emit MarketUpdated(
                ctx.positions[i].marketId,
                ctx.prices[i],
                marketUpdateData.skew,
                marketUpdateData.size,
                newPositionSize - ctx.positions[i].size,
                marketUpdateData.currentFundingRate,
                marketUpdateData.currentFundingVelocity,
                marketUpdateData.interestRate
            );

            emit PositionLiquidated(
                ctx.accountId,
                ctx.positions[i].marketId,
                amountLiquidated,
                newPositionSize
            );
        }

        uint256 totalFlaggingRewards;
        for (uint256 j = 0;j <= MathUtil.min(i, ctx.positions.length - 1);j++) {
            // using oldPositionAbsSize to calculate flag reward
            if (
                ERC2771Context._msgSender() !=
                PerpsMarketConfiguration.load(ctx.positions[j].marketId).endorsedLiquidator
            ) {
                    totalFlaggingRewards += PerpsMarketConfiguration
                        .load(ctx.positions[j].marketId)
                        .calculateFlagReward(MathUtil.abs(ctx.positions[j].size).mulDecimal(ctx.prices[j]));
            }
        }

        if (
            ERC2771Context._msgSender() !=
            PerpsMarketConfiguration.load(ctx.positions[MathUtil.min(i, ctx.positions.length - 1)].marketId).endorsedLiquidator
        ) {
            

            // Use max of collateral or positions flag rewards
            uint256 totalCollateralLiquidateRewards = GlobalPerpsMarketConfiguration
                .load()
                .calculateCollateralLiquidateReward(totalCollateralValue);

            totalFlaggingRewards = MathUtil.max(
                totalCollateralLiquidateRewards,
                totalFlaggingRewards
            );
        }

        bool accountFullyLiquidated;

        uint256 totalLiquidationCost =
            KeeperCosts.load().getLiquidateKeeperCosts() +
            costOfFlagExecution;
        if (positionFlagged || totalLiquidated > 0) {
            keeperLiquidationReward = _processLiquidationRewards(
                positionFlagged ? totalFlaggingRewards : 0,
                totalLiquidationCost,
                totalCollateralValue
            );
            accountFullyLiquidated = PerpsAccount.load(ctx.accountId).openPositionMarketIds.length() == 0;
            if (
                accountFullyLiquidated &&
                GlobalPerpsMarket.load().liquidatableAccounts.contains(ctx.accountId)
            ) {
                GlobalPerpsMarket.load().liquidatableAccounts.remove(ctx.accountId);
            }
        }

        emit AccountLiquidationAttempt(
            ctx.accountId,
            keeperLiquidationReward,
            accountFullyLiquidated
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
