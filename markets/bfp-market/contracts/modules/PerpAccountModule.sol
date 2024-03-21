//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Position} from "../storage/Position.sol";
import {Margin} from "../storage/Margin.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "../storage/PerpMarketConfiguration.sol";
import {IPerpAccountModule} from "../interfaces/IPerpAccountModule.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";

contract PerpAccountModule is IPerpAccountModule {
    using DecimalMath for uint256;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
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

    /**
     * @inheritdoc IPerpAccountModule
     */
    function mergeAccounts(uint128 fromId, uint128 toId, uint128 marketId) external {
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

        if (fromPosition.entryTime != block.timestamp) {
            revert ErrorUtil.PositionTooOld();
        }

        uint256 oraclePrice = market.getOraclePrice();

        Margin.MarginValues memory toMarginValues = Margin.getMarginUsd(toId, market, oraclePrice);
        if (
            Position.isLiquidatable(toPosition, market, oraclePrice, marketConfig, toMarginValues)
        ) {
            revert ErrorUtil.CanLiquidatePosition();
        }

        // Realize the toPostion.
        toAccountMargin.updateAccountDebtAndCollateral(
            market,
            toMarginValues.marginUsd.toInt() - toMarginValues.collateralUsd.toInt()
        );

        // Move collateral `from` -> `to`.
        toAccountMargin.collaterals[synthMarketId] += fromAccountCollateral;
        fromAccountMargin.collaterals[synthMarketId] = 0;

        // Update position accounting `from` -> `to`.
        toPosition.update(
            Position.Data(
                toPosition.size + fromPosition.size,
                block.timestamp,
                market.currentFundingAccruedComputed,
                market.currentUtilizationAccruedComputed,
                oraclePrice,
                fromPosition.accruedFeesUsd
            )
        );
        delete market.positions[fromId];

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

        emit AccountsMerged(fromId, toId, marketId);
    }
}
