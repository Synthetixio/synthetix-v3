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
     * Finds the collateral with the same oracle as the market.
     * We expect this to be called for an account that just had a postion settled, which gurantees we have some collateral.
     * If also validates that the account doesn't have any other collateral.
     */
    function getMatchingMarketCollateral(
        Margin.Data storage fromAccountMargin,
        PerpMarketConfiguration.Data storage marketConfig
    ) internal view returns (uint128 synthMarketId, uint256 fromAccountCollateral) {
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        // Variables for loop, to save some gas.
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
                    // If the from account have collateral >0 with different oracle node id then the market, revert.
                    revert ErrorUtil.OracleNodeMismatch();
                }
                // We found the matching collateral set it the return values.
                // We're not breaking here as we want to check if the account has any other collateral and revert if it does.
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
        Margin.Data storage fromAccountMargin = Margin.load(fromId, marketId);

        (uint128 synthMarketId, uint256 fromAccountCollateral) = getMatchingMarketCollateral(
            fromAccountMargin,
            marketConfig
        );

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

        uint256 oraclePrice = market.getOraclePrice();

        Margin.MarginValues memory toMarginValues = Margin.getMarginUsd(toId, market, oraclePrice);
        // Determine if toPosition can be immediately liquidated.
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

        // Move collateral.
        toAccountMargin.collaterals[synthMarketId] += fromAccountCollateral;
        fromAccountMargin.collaterals[synthMarketId] = 0;

        // Update toAccount's postion with data from the fromAccount's position.
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

        emit AccountMerged(fromId, toId, marketId);
    }
}
