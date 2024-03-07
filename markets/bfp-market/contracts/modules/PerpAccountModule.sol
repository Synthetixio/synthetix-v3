//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Position} from "../storage/Position.sol";
import {Margin} from "../storage/Margin.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "../storage/PerpMarketConfiguration.sol";
import {IPerpAccountModule} from "../interfaces/IPerpAccountModule.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";

contract PerpAccountModule is IPerpAccountModule {
    using DecimalMath for uint256;
    using SafeCastU256 for uint256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;
    using Margin for Margin.GlobalData;
    using Margin for Margin.Data;

    /**
     * @inheritdoc IPerpAccountModule
     */
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

    /**
     * @inheritdoc IPerpAccountModule
     */
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

    /**
     * @dev Generic helper for funding recomputation during order management.
     */
    function recomputeUtilization(PerpMarket.Data storage market, uint256 price) private {
        (uint256 utilizationRate, ) = market.recomputeUtilization(price);
        emit UtilizationRecomputed(market.id, market.skew, utilizationRate);
    }

    /**
     * @dev Generic helper for funding recomputation during order management.
     */
    function recomputeFunding(PerpMarket.Data storage market, uint256 price) private {
        (int256 fundingRate, ) = market.recomputeFunding(price);
        emit FundingRecomputed(
            market.id,
            market.skew,
            fundingRate,
            market.getCurrentFundingVelocity()
        );
    }
    // A struct to hold all the data needed to merge accounts to avoid stack too deep.

    struct Runtime_MergeAccounts {
        uint256 oraclePrice;
        Margin.MarginValues fromMarginValues;
        Margin.MarginValues toMarginValues;
    }

    function realizePositions(
        Runtime_MergeAccounts memory runtime,
        PerpMarket.Data storage market,
        Position.Data storage toPosition,
        Position.Data storage fromPosition,
        Margin.Data storage toAccountMargin,
        Margin.Data storage fromAccountMargin,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal {
        recomputeFunding(market, runtime.oraclePrice);

        // Determine if toPosition can be immediately liquidated.
        if (
            Position.isLiquidatable(
                toPosition,
                market,
                runtime.oraclePrice,
                marketConfig,
                runtime.toMarginValues
            )
        ) {
            revert ErrorUtil.CanLiquidatePosition();
        }
        // Determine if fromPosition can be immediately liquidated.
        if (
            Position.isLiquidatable(
                fromPosition,
                market,
                runtime.oraclePrice,
                marketConfig,
                runtime.fromMarginValues
            )
        ) {
            revert ErrorUtil.CanLiquidatePosition();
        }

        // Update margin for both accounts
        fromAccountMargin.updateAccountDebtAndCollateral(
            market,
            runtime.fromMarginValues.marginUsd.toInt() -
                runtime.fromMarginValues.collateralUsd.toInt()
        );

        toAccountMargin.updateAccountDebtAndCollateral(
            market,
            runtime.toMarginValues.marginUsd.toInt() - runtime.toMarginValues.collateralUsd.toInt()
        );

        recomputeUtilization(market, runtime.oraclePrice);
    }

    function mergeAccounts(
        uint128 fromId,
        uint128 toId,
        uint128 marketId,
        uint128 synthMarketId
    ) external {
        // Check msg sender is owner for both the accounts.
        Account.loadAccountAndValidatePermission(
            fromId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION // TODO maybe new permission?
        );
        Account.loadAccountAndValidatePermission(
            toId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION // TODO maybe new permission?
        );
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        if (globalMarginConfig.supported[synthMarketId].oracleNodeId != marketConfig.oracleNodeId) {
            revert ErrorUtil.OracleNodeMismatch();
        }

        Runtime_MergeAccounts memory runtime;

        Margin.Data storage fromAccountMargin = Margin.load(fromId, marketId);
        Margin.Data storage toAccountMargin = Margin.load(toId, marketId);

        Position.Data storage fromPosition = market.positions[fromId];
        Position.Data storage toPosition = market.positions[toId];

        if (toPosition.size == 0 || fromPosition.size == 0) {
            revert ErrorUtil.PositionNotFound();
        }

        uint256 fromAccountCollateral = fromAccountMargin.collaterals[synthMarketId];
        uint256 toAccountCollateral = toAccountMargin.collaterals[synthMarketId];

        if (fromAccountCollateral == 0 || toAccountCollateral == 0) {
            revert ErrorUtil.NilCollateral();
        }

        runtime.oraclePrice = market.getOraclePrice();
        runtime.fromMarginValues = Margin.getMarginUsd(fromId, market, runtime.oraclePrice);
        runtime.toMarginValues = Margin.getMarginUsd(toId, market, runtime.oraclePrice);

        realizePositions(
            runtime,
            market,
            toPosition,
            fromPosition,
            toAccountMargin,
            fromAccountMargin,
            marketConfig
        );

        // Move position size.
        toPosition.size += fromPosition.size;
        fromPosition.size = 0;

        // Update entry price.
        toPosition.entryPrice = runtime.oraclePrice;

        // Move debt.
        toAccountMargin.debtUsd += fromAccountMargin.debtUsd;
        fromAccountMargin.debtUsd = 0;

        // Move collateral.
        toAccountMargin.collaterals[synthMarketId] += fromAccountCollateral;
        fromAccountMargin.collaterals[synthMarketId] = 0;

        if (SYNTHETIX_USD_MARKET_ID != synthMarketId) {
            // If collateral use is non USD we might have gotten some sUSD profit from realizingthe the position. Make sure that is moved over too.
            uint256 fromSUsdCollateral = fromAccountMargin.collaterals[SYNTHETIX_USD_MARKET_ID];
            if (fromSUsdCollateral > 0) {
                toAccountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] += fromSUsdCollateral;
                fromAccountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] = 0;
            }
        }

        Margin.MarginValues memory newMarginValues = Margin.getMarginUsd(
            toId,
            market,
            runtime.oraclePrice
        );

        (uint256 im, , ) = Position.getLiquidationMarginUsd(
            toPosition.size,
            runtime.oraclePrice,
            newMarginValues.collateralUsd,
            marketConfig
        );
        if (newMarginValues.marginUsd < im) {
            revert ErrorUtil.InsufficientMargin();
        }
    }
}
