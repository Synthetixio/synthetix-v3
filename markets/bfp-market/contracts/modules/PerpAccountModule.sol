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
        uint256 im;
        uint128 debtToMove;
        int128 sizeToMove;
        uint256 supportedSynthMarketIdsLength;
        uint128 synthMarketId;
        uint256 collateralToMove;
        uint256 fromAccountCollateral;
        uint256 toCollateralUsd;
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

        if (proportion > DecimalMath.UNIT) {
            revert ErrorUtil.AccountSplitProportionTooLarge();
        }
        if (proportion == 0) {
            revert ErrorUtil.ZeroProportion();
        }
        // Ensure there are no pending orders from both to/from accounts.
        if (market.orders[toId].sizeDelta != 0 || market.orders[fromId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }
        if (toPosition.size != 0) {
            revert ErrorUtil.PositionFound(toId, marketId);
        }
        // Verify the `toId` account is empty. We asset has collateral but we don't need to check debt as
        // it is impossible for a trader to have debt and zero collateral.
        if (Margin.hasCollateralDeposited(toId, marketId)) {
            revert ErrorUtil.CollateralFound();
        }
        if (market.flaggedLiquidations[fromId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }

        runtime.oraclePrice = market.getOraclePrice();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        Position.Data storage fromPosition = market.positions[fromId];

        // From account should not be liquidatable.
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

        // Move collaterals from `from` -> `to`.
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage fromAccountMargin = Margin.load(fromId, marketId);
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        runtime.supportedSynthMarketIdsLength = globalMarginConfig.supportedSynthMarketIds.length;

        for (uint256 i = 0; i < runtime.supportedSynthMarketIdsLength; ) {
            runtime.synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            runtime.fromAccountCollateral = fromAccountMargin.collaterals[runtime.synthMarketId];
            if (runtime.fromAccountCollateral > 0) {
                // Move collateral `from` -> `to`.
                runtime.collateralToMove = runtime.fromAccountCollateral.mulDecimal(proportion);
                toAccountMargin.collaterals[runtime.synthMarketId] = runtime.collateralToMove;
                fromAccountMargin.collaterals[runtime.synthMarketId] -= runtime.collateralToMove;
                runtime.toCollateralUsd += runtime.collateralToMove.mulDecimal(
                    globalMarginConfig.getCollateralPrice(runtime.synthMarketId, globalConfig)
                );
            }

            unchecked {
                ++i;
            }
        }

        if (fromAccountMargin.debtUsd > 0) {
            // Move debt from `from` -> `to`.
            runtime.debtToMove = fromAccountMargin.debtUsd.mulDecimal(proportion).to128();
            toAccountMargin.debtUsd = runtime.debtToMove;
            fromAccountMargin.debtUsd -= runtime.debtToMove;
        }

        // Move position from `from` -> `to`.
        runtime.sizeToMove = fromPosition.size.mulDecimal(proportion.toInt()).to128();

        if (fromPosition.size < 0) {
            fromPosition.size += MathUtil.abs(runtime.sizeToMove).toInt().to128();
        } else {
            fromPosition.size -= runtime.sizeToMove;
        }

        toPosition.update(
            Position.Data(
                runtime.sizeToMove,
                fromPosition.entryTime,
                fromPosition.entryFundingAccrued,
                fromPosition.entryUtilizationAccrued,
                fromPosition.entryPrice
            )
        );

        // Make sure the `toAccount` has enough margin for IM.
        (runtime.im, , ) = Position.getLiquidationMarginUsd(
            toPosition.size,
            runtime.oraclePrice,
            runtime.toCollateralUsd,
            marketConfig
        );

        if (
            runtime.toCollateralUsd.toInt() +
                Margin.getPnlAdjustmentUsd(toId, market, runtime.oraclePrice) <
            runtime.im.toInt()
        ) {
            revert ErrorUtil.InsufficientMargin();
        }

        emit AccountSplit(fromId, toId, marketId);
    }

    /**
     * @dev Returns the matching margin collateral equal to market.
     *
     * Upstream invocations are expected to be called in the same block as position settlement. This guarantees the
     * same collateral. However, if any additional collateral or a mismatch does occur, a revert is thrown.
     */
    function getMatchingMarketCollateral(
        Margin.Data storage fromAccountMargin,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint128 synthMarketId, uint256 fromAccountCollateral) {
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        bytes32 marketOracleNodeId = marketConfig.oracleNodeId;
        uint256 supportedSynthMarketIdsLength = globalMarginConfig.supportedSynthMarketIds.length;
        uint128 currentSynthMarketId;
        uint256 currentFromAccountCollateral;

        for (uint256 i = 0; i < supportedSynthMarketIdsLength; ) {
            currentSynthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            currentFromAccountCollateral = fromAccountMargin.collaterals[currentSynthMarketId];
            if (currentFromAccountCollateral > 0) {
                if (
                    globalMarginConfig.supported[currentSynthMarketId].oracleNodeId !=
                    marketOracleNodeId
                ) {
                    // Revert if `fromAccount` has collateral >0 with different oracleNodeId than market.
                    revert ErrorUtil.OracleNodeMismatch();
                }

                // Found matching collateral!
                //
                // NOTE: We do _not_ break out here as we continue checking if account as other collaterals.
                synthMarketId = currentSynthMarketId;
                fromAccountCollateral = currentFromAccountCollateral;
            }

            unchecked {
                ++i;
            }
        }
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

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        Margin.Data storage fromAccountMargin = Margin.load(fromId, marketId);

        (uint128 synthMarketId, uint256 fromAccountCollateral) = getMatchingMarketCollateral(
            fromAccountMargin,
            marketConfig
        );

        Margin.Data storage toAccountMargin = Margin.load(toId, marketId);
        Position.Data storage fromPosition = market.positions[fromId];
        Position.Data storage toPosition = market.positions[toId];

        if (market.orders[toId].sizeDelta != 0 || market.orders[fromId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        // Prevent flagged positions from merging.
        if (
            market.flaggedLiquidations[fromId] != address(0) ||
            market.flaggedLiquidations[toId] != address(0)
        ) {
            revert ErrorUtil.PositionFlagged();
        }

        // Prevent merging positions that are not within the same block.
        if (fromPosition.entryTime != block.timestamp) {
            revert ErrorUtil.PositionTooOld();
        }

        // Only settlement hooks are allowed to merge accounts.
        if (!SettlementHookConfiguration.load().whitelisted[msg.sender]) {
            revert ErrorUtil.InvalidHook(msg.sender);
        }

        uint256 oraclePrice = market.getOraclePrice();
        Margin.MarginValues memory toMarginValues = Margin.getMarginUsd(toId, market, oraclePrice);

        // Prevent merging for is liquidatable positions.
        if (
            Position.isLiquidatable(toPosition, market, oraclePrice, marketConfig, toMarginValues)
        ) {
            revert ErrorUtil.CanLiquidatePosition();
        }

        // Realize the toPosition.
        toAccountMargin.realizeAccountPnlAndUpdate(
            market,
            toMarginValues.marginUsd.toInt() - toMarginValues.collateralUsd.toInt()
        );

        // Move collateral `from` -> `to`.
        toAccountMargin.collaterals[synthMarketId] += fromAccountCollateral;
        fromAccountMargin.collaterals[synthMarketId] = 0;

        // Move debt `from` -> `to`.
        toAccountMargin.debtUsd += fromAccountMargin.debtUsd;
        fromAccountMargin.debtUsd = 0;

        // Update position accounting `from` -> `to`.
        toPosition.update(
            Position.Data(
                toPosition.size + fromPosition.size,
                block.timestamp,
                market.currentFundingAccruedComputed,
                market.currentUtilizationAccruedComputed,
                oraclePrice
            )
        );
        delete market.positions[fromId];

        // Stack too deep.
        {
            uint256 collateralUsd = Margin.getCollateralUsdWithoutDiscount(toId, marketId);
            (uint256 im, , ) = Position.getLiquidationMarginUsd(
                toPosition.size,
                oraclePrice,
                collateralUsd,
                marketConfig
            );

            if (
                collateralUsd.toInt() + Margin.getPnlAdjustmentUsd(toId, market, oraclePrice) <
                im.toInt()
            ) {
                revert ErrorUtil.InsufficientMargin();
            }
        }

        emit AccountsMerged(fromId, toId, marketId);
    }
}
