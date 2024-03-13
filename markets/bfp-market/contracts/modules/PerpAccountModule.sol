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

    // --- Runtime structs --- //

    struct Runtime_mergeAccounts {
        uint256 oraclePrice;
        uint256 supportedSynthMarketIdsLength;
        uint128 synthMarketId;
        uint128 synthMarketIdForLoop;
        uint256 fromAccountCollateralForLoop;
        uint256 fromAccountCollateral;
        uint256 im;
    }

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

    function realizePosition(
        PerpMarket.Data storage market,
        Position.Data storage position,
        Margin.MarginValues memory marginValues,
        Margin.Data storage accountMargin,
        PerpMarketConfiguration.Data storage marketConfig,
        uint256 oraclePrice
    ) private {
        // Determine if toPosition can be immediately liquidated.
        if (Position.isLiquidatable(position, market, oraclePrice, marketConfig, marginValues)) {
            revert ErrorUtil.CanLiquidatePosition();
        }

        accountMargin.updateAccountDebtAndCollateral(
            market,
            marginValues.marginUsd.toInt() - marginValues.collateralUsd.toInt()
        );
    }

    /**
     * @inheritdoc IPerpAccountModule
     */
    function mergeAccounts(uint128 fromId, uint128 toId, uint128 marketId) external {
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
        Margin.Data storage fromAccountMargin = Margin.load(fromId, marketId);

        Runtime_mergeAccounts memory runtime;

        runtime.supportedSynthMarketIdsLength = globalMarginConfig.supportedSynthMarketIds.length;

        for (uint256 i = 0; i < runtime.supportedSynthMarketIdsLength; ) {
            runtime.synthMarketIdForLoop = globalMarginConfig.supportedSynthMarketIds[i];
            runtime.fromAccountCollateralForLoop = fromAccountMargin.collaterals[
                runtime.synthMarketIdForLoop
            ];
            if (runtime.fromAccountCollateralForLoop > 0) {
                if (
                    globalMarginConfig.supported[runtime.synthMarketIdForLoop].oracleNodeId !=
                    marketConfig.oracleNodeId
                ) {
                    // If the from account have collateral >0 with different oracle node id then the market, revert.
                    revert ErrorUtil.OracleNodeMismatch();
                }
                // This is the collateral we're intrested in and it has correct oracle node id.
                runtime.synthMarketId = runtime.synthMarketIdForLoop;
                runtime.fromAccountCollateral = runtime.fromAccountCollateralForLoop;
            }

            unchecked {
                ++i;
            }
        }

        Margin.Data storage toAccountMargin = Margin.load(toId, marketId);
        Position.Data storage fromPosition = market.positions[fromId];
        Position.Data storage toPosition = market.positions[toId];

        if (fromPosition.entryTime != block.timestamp) {
            revert ErrorUtil.PositionTooOld();
        }
        if (market.orders[toId].sizeDelta != 0) {
            // We only have to check "toAccount" as its impossible for fromAccount to have an order.
            revert ErrorUtil.OrderFound();
        }

        runtime.oraclePrice = market.getOraclePrice();

        realizePosition(
            market,
            toPosition,
            Margin.getMarginUsd(toId, market, runtime.oraclePrice),
            toAccountMargin,
            marketConfig,
            runtime.oraclePrice
        );

        // Move collateral.
        toAccountMargin.collaterals[runtime.synthMarketId] += runtime.fromAccountCollateral;
        fromAccountMargin.collaterals[runtime.synthMarketId] = 0;

        // Update toAccount's postion with data from the fromAccount's position.
        Position.Data memory newPosition = Position.Data(
            toPosition.size + fromPosition.size,
            block.timestamp,
            market.currentFundingAccruedComputed,
            market.currentUtilizationAccruedComputed,
            runtime.oraclePrice,
            fromPosition.accruedFeesUsd
        );

        toPosition.update(newPosition);
        delete market.positions[fromId];

        Margin.MarginValues memory newMarginValues = Margin.getMarginUsd(
            toId,
            market,
            runtime.oraclePrice
        );

        (runtime.im, , ) = Position.getLiquidationMarginUsd(
            toPosition.size,
            runtime.oraclePrice,
            newMarginValues.collateralUsd,
            marketConfig
        );
        if (newMarginValues.marginUsd < runtime.im) {
            revert ErrorUtil.InsufficientMargin();
        }

        emit AccountMerged(fromId, toId, marketId);
    }
}
