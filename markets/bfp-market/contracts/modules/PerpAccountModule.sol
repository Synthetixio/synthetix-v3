//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastU256, SafeCastI256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Position} from "../storage/Position.sol";
import {Margin} from "../storage/Margin.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {IPerpAccountModule} from "../interfaces/IPerpAccountModule.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {Flags} from "../utils/Flags.sol";
import {SettlementHookConfiguration} from "../storage/SettlementHookConfiguration.sol";

/* solhint-disable meta-transactions/no-msg-sender */

contract PerpAccountModule is IPerpAccountModule {
    using DecimalMath for uint256;
    using DecimalMath for uint128;
    using DecimalMath for int128;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;
    using Margin for Margin.GlobalData;
    using Margin for Margin.Data;

    // --- Runtime structs --- //

    struct Runtime_splitAccount {
        uint256 oraclePrice;
        uint256 toIm;
        uint256 fromIm;
        uint128 debtToMove;
        int128 sizeToMove;
        uint256 supportedSynthMarketIdsLength;
        uint128 synthMarketId;
        uint256 collateralToMove;
        uint256 newFromAmountCollateral;
        uint256 fromAccountCollateral;
        uint256 toCollateralUsd;
        uint256 fromCollateralUsd;
        uint256 toDiscountedCollateralUsd;
        uint256 fromDiscountedCollateralUsd;
        uint256 collateralPrice;
    }

    struct Runtime_mergeAccounts {
        uint256 oraclePrice;
        uint256 pythPrice;
        uint256 im;
        uint256 fromCollateralUsd;
        uint256 fromMarginUsd;
        uint256 toMarginUsd;
        uint256 mergedCollateralUsd;
        uint256 mergedDiscountedCollateralUsd;
        uint256 supportedSynthMarketIdsLength;
        uint128 synthMarketId;
        uint256 fromAccountCollateral;
    }

    /// @inheritdoc IPerpAccountModule
    function getAccountDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IPerpAccountModule.AccountDigest memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        IPerpAccountModule.DepositedCollateral[]
            memory depositedCollaterals = new DepositedCollateral[](length);
        uint128 synthMarketId;
        uint256 collateralPrice;

        for (uint256 i = 0; i < length; ) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            collateralPrice = globalMarginConfig.getCollateralPrice(synthMarketId, globalConfig);
            depositedCollaterals[i] = IPerpAccountModule.DepositedCollateral(
                synthMarketId,
                accountMargin.collaterals[synthMarketId],
                collateralPrice
            );

            unchecked {
                ++i;
            }
        }

        return
            IPerpAccountModule.AccountDigest(
                depositedCollaterals,
                Margin.getMarginUsd(accountId, market, market.getOraclePrice()).collateralUsd,
                accountMargin.debtUsd,
                getPositionDigest(accountId, marketId)
            );
    }

    /// @inheritdoc IPerpAccountModule
    function getPositionDigest(
        uint128 accountId,
        uint128 marketId
    ) public view returns (IPerpAccountModule.PositionDigest memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Position.Data storage position = market.positions[accountId];

        if (position.size == 0) {
            IPerpAccountModule.PositionDigest memory emptyPositionDigest;
            return emptyPositionDigest;
        }

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        uint256 oraclePrice = market.getOraclePrice();
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            oraclePrice
        );

        Position.HealthData memory healthData = Position.getHealthData(
            market,
            position.size,
            position.entryPrice,
            position.entryFundingAccrued,
            position.entryUtilizationAccrued,
            oraclePrice,
            marketConfig,
            marginValues
        );
        (uint256 im, uint256 mm, ) = Position.getLiquidationMarginUsd(
            position.size,
            oraclePrice,
            marginValues.collateralUsd,
            marketConfig
        );

        return
            IPerpAccountModule.PositionDigest(
                accountId,
                marketId,
                marginValues.discountedMarginUsd,
                healthData.healthFactor,
                MathUtil.abs(position.size).mulDecimal(oraclePrice), // notionalValueUsd
                healthData.pnl,
                healthData.accruedFunding,
                healthData.accruedUtilization,
                position.entryPrice,
                oraclePrice,
                position.size,
                im,
                mm
            );
    }

    /// @inheritdoc IPerpAccountModule
    function splitAccount(
        uint128 fromId,
        uint128 toId,
        uint128 marketId,
        uint128 proportion
    ) external {
        FeatureFlag.ensureAccessToFeature(Flags.SPLIT_ACCOUNT);
        Account.loadAccountAndValidatePermission(
            fromId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );
        Account.loadAccountAndValidatePermission(
            toId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

        if (toId == fromId) {
            revert ErrorUtil.DuplicateAccountIds();
        }

        Runtime_splitAccount memory runtime;

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.Data storage toAccountMargin = Margin.load(toId, marketId);
        Position.Data storage toPosition = market.positions[toId];
        Position.Data storage fromPosition = market.positions[fromId];

        // Cannot split more than what's available.
        if (proportion > DecimalMath.UNIT) {
            revert ErrorUtil.AccountSplitProportionTooLarge();
        }

        // Disallow no-ops.
        if (proportion == 0) {
            revert ErrorUtil.ZeroProportion();
        }

        // Ensure there are no pending orders from both to/from accounts.
        if (market.orders[toId].sizeDelta != 0 || market.orders[fromId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        // Account to split into must be empty.
        if (toPosition.size != 0) {
            revert ErrorUtil.PositionFound(toId, marketId);
        }

        // Can only split from an account that has a position.
        if (fromPosition.size == 0) {
            revert ErrorUtil.PositionNotFound();
        }

        // `toId` account must be empty (i.e. no debt or collateral).
        if (Margin.hasCollateralDeposited(toId, marketId) || toAccountMargin.debtUsd != 0) {
            revert ErrorUtil.CollateralFound();
        }

        // Cannot split a position flagged for liquidation.
        if (market.flaggedLiquidations[fromId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }

        runtime.oraclePrice = market.getOraclePrice();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);

        // `fromAccount` position should not be liquidatable.
        if (
            Position.isLiquidatable(
                fromPosition,
                market,
                runtime.oraclePrice,
                marketConfig,
                Margin.getMarginUsd(fromId, market, runtime.oraclePrice)
            )
        ) {
            revert ErrorUtil.CanLiquidatePosition();
        }

        // Move collaterals `from` -> `to`.
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage fromAccountMargin = Margin.load(fromId, marketId);
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        runtime.supportedSynthMarketIdsLength = globalMarginConfig.supportedSynthMarketIds.length;

        for (uint256 i = 0; i < runtime.supportedSynthMarketIdsLength; ) {
            runtime.synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            runtime.fromAccountCollateral = fromAccountMargin.collaterals[runtime.synthMarketId];

            if (runtime.fromAccountCollateral > 0) {
                // Move available collateral `from` -> `to`.
                runtime.collateralToMove = runtime.fromAccountCollateral.mulDecimal(proportion);
                toAccountMargin.collaterals[runtime.synthMarketId] = runtime.collateralToMove;
                fromAccountMargin.collaterals[runtime.synthMarketId] -= runtime.collateralToMove;
                runtime.collateralPrice = globalMarginConfig.getCollateralPrice(
                    runtime.synthMarketId,
                    globalConfig
                );

                uint256 fromAccountCollateralUsd = runtime.fromAccountCollateral.mulDecimal(
                    runtime.collateralPrice
                );
                uint256 collateralToMoveUsd = runtime.collateralToMove.mulDecimal(
                    runtime.collateralPrice
                );

                // Track both toCollateralUsd and toDiscountedCollateralUsd.
                runtime.toCollateralUsd += collateralToMoveUsd;
                runtime.toDiscountedCollateralUsd += runtime.collateralToMove.mulDecimal(
                    Margin.getDiscountedCollateralPrice(
                        runtime.collateralToMove,
                        runtime.collateralPrice,
                        runtime.synthMarketId,
                        globalConfig
                    )
                );

                // Track both fromCollateralUsd and fromCollateralDiscountedUsd.
                runtime.fromCollateralUsd += fromAccountCollateralUsd - collateralToMoveUsd;

                // Calculate the discounted price for the new from amount.
                runtime.newFromAmountCollateral =
                    runtime.fromAccountCollateral -
                    runtime.collateralToMove;
                runtime.fromDiscountedCollateralUsd += runtime.newFromAmountCollateral.mulDecimal(
                    Margin.getDiscountedCollateralPrice(
                        runtime.newFromAmountCollateral,
                        runtime.collateralPrice,
                        runtime.synthMarketId,
                        globalConfig
                    )
                );
            }

            unchecked {
                ++i;
            }
        }

        if (fromAccountMargin.debtUsd > 0) {
            // Move debt `from` -> `to`.
            runtime.debtToMove = fromAccountMargin.debtUsd.mulDecimal(proportion).to128();
            toAccountMargin.debtUsd = runtime.debtToMove;
            fromAccountMargin.debtUsd -= runtime.debtToMove;
        }

        // Move position `from` -> `to`.
        runtime.sizeToMove = fromPosition.size.mulDecimal(proportion.toInt()).to128();

        if (fromPosition.size < 0) {
            fromPosition.size += MathUtil.abs(runtime.sizeToMove).toInt().to128();
        } else {
            fromPosition.size -= runtime.sizeToMove;
        }

        toPosition.update(
            Position.Data(
                runtime.sizeToMove,
                fromPosition.entryFundingAccrued,
                fromPosition.entryUtilizationAccrued,
                fromPosition.entryPythPrice,
                fromPosition.entryPrice
            )
        );

        // Ensure `toAccount` has enough margin to meet IM.
        (runtime.toIm, , ) = Position.getLiquidationMarginUsd(
            toPosition.size,
            runtime.oraclePrice,
            runtime.toCollateralUsd,
            marketConfig
        );
        if (
            runtime.toDiscountedCollateralUsd.toInt() +
                Margin.getPnlAdjustmentUsd(toId, market, runtime.oraclePrice) <
            runtime.toIm.toInt()
        ) {
            revert ErrorUtil.InsufficientMargin();
        }

        // Ensure we validate remaining `fromAccount` margin > IM when position still remains.
        if (proportion < DecimalMath.UNIT) {
            (runtime.fromIm, , ) = Position.getLiquidationMarginUsd(
                fromPosition.size,
                runtime.oraclePrice,
                runtime.fromCollateralUsd,
                marketConfig
            );
            if (
                runtime.fromDiscountedCollateralUsd.toInt() +
                    Margin.getPnlAdjustmentUsd(fromId, market, runtime.oraclePrice) <
                runtime.fromIm.toInt()
            ) {
                revert ErrorUtil.InsufficientMargin();
            }
        } else if (proportion == DecimalMath.UNIT) {
            // Clear out the `fromPosition` when the split is 1.
            delete market.positions[fromId];
        }

        emit AccountSplit(fromId, toId, marketId);
    }

    /// @inheritdoc IPerpAccountModule
    function mergeAccounts(uint128 fromId, uint128 toId, uint128 marketId) external {
        FeatureFlag.ensureAccessToFeature(Flags.MERGE_ACCOUNT);
        Account.loadAccountAndValidatePermission(
            fromId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );
        Account.loadAccountAndValidatePermission(
            toId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

        if (toId == fromId) {
            revert ErrorUtil.DuplicateAccountIds();
        }
        Runtime_mergeAccounts memory runtime;

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        Margin.Data storage fromAccountMargin = Margin.load(fromId, marketId);
        Margin.Data storage toAccountMargin = Margin.load(toId, marketId);
        Position.Data storage fromPosition = market.positions[fromId];
        Position.Data storage toPosition = market.positions[toId];

        if (market.orders[toId].sizeDelta != 0 || market.orders[fromId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }
        if (!MathUtil.sameSide(fromPosition.size, toPosition.size)) {
            revert ErrorUtil.InvalidPositionSide();
        }

        // Prevent flagged positions from merging.
        if (
            market.flaggedLiquidations[fromId] != address(0) ||
            market.flaggedLiquidations[toId] != address(0)
        ) {
            revert ErrorUtil.PositionFlagged();
        }

        // Only settlement hooks are allowed to merge accounts.
        if (!SettlementHookConfiguration.load().whitelisted[msg.sender]) {
            revert ErrorUtil.InvalidHook(msg.sender);
        }

        runtime.oraclePrice = market.getOraclePrice();

        Margin.MarginValues memory toMarginValues = Margin.getMarginUsd(
            toId,
            market,
            runtime.oraclePrice
        );

        // Prevent merging for liquidatable positions.
        if (
            Position.isLiquidatable(
                toPosition,
                market,
                runtime.oraclePrice,
                marketConfig,
                toMarginValues
            )
        ) {
            revert ErrorUtil.CanLiquidatePosition();
        }

        runtime.fromCollateralUsd = Margin.getCollateralUsdWithoutDiscount(fromId, marketId);
        runtime.fromMarginUsd = MathUtil
            .max(
                runtime.fromCollateralUsd.toInt() +
                    Margin.getPnlAdjustmentFillPriceUsd(
                        fromId,
                        market,
                        runtime.oraclePrice,
                        fromPosition.entryPythPrice
                    ),
                0
            )
            .toUint();

        // Realize the fromPosition.
        fromAccountMargin.realizeAccountPnlAndUpdate(
            market,
            runtime.fromMarginUsd.toInt() - runtime.fromCollateralUsd.toInt()
        );
        runtime.toMarginUsd = MathUtil
            .max(
                toMarginValues.collateralUsd.toInt() +
                    Margin.getPnlAdjustmentFillPriceUsd(
                        toId,
                        market,
                        runtime.oraclePrice,
                        fromPosition.entryPythPrice
                    ),
                0
            )
            .toUint();

        // Realize the toPosition.
        toAccountMargin.realizeAccountPnlAndUpdate(
            market,
            runtime.toMarginUsd.toInt() - toMarginValues.collateralUsd.toInt()
        );

        runtime.supportedSynthMarketIdsLength = globalMarginConfig.supportedSynthMarketIds.length;
        runtime.synthMarketId;
        runtime.fromAccountCollateral;
        for (uint256 i = 0; i < runtime.supportedSynthMarketIdsLength; ) {
            runtime.synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            runtime.fromAccountCollateral = fromAccountMargin.collaterals[runtime.synthMarketId];
            if (runtime.fromAccountCollateral > 0) {
                // Move collateral `from` -> `to`.
                toAccountMargin.collaterals[runtime.synthMarketId] += runtime.fromAccountCollateral;
                fromAccountMargin.collaterals[runtime.synthMarketId] = 0;
            }

            unchecked {
                ++i;
            }
        }

        // Move debt `from` -> `to`.
        toAccountMargin.debtUsd += fromAccountMargin.debtUsd;
        fromAccountMargin.debtUsd = 0;

        // Update position accounting `from` -> `to`.
        toPosition.update(
            Position.Data(
                toPosition.size + fromPosition.size,
                market.currentFundingAccruedComputed,
                market.currentUtilizationAccruedComputed,
                runtime.pythPrice, // entryPythPrice
                runtime.pythPrice // entryPrice
            )
        );
        delete market.positions[fromId];

        (runtime.mergedCollateralUsd, runtime.mergedDiscountedCollateralUsd) = Margin
            .getCollateralUsd(toId, marketId);
        (runtime.im, , ) = Position.getLiquidationMarginUsd(
            toPosition.size,
            runtime.oraclePrice,
            runtime.mergedCollateralUsd,
            marketConfig
        );

        if (
            runtime.mergedDiscountedCollateralUsd.toInt() +
                Margin.getPnlAdjustmentUsd(toId, market, runtime.oraclePrice) <
            runtime.im.toInt()
        ) {
            revert ErrorUtil.InsufficientMargin();
        }

        emit AccountsMerged(fromId, toId, marketId);
    }
}
