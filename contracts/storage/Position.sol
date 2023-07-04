//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {Error} from "./Error.sol";
import {Order} from "./Order.sol";
import {PerpMarket} from "./PerpMarket.sol";
import {PerpMarketFactoryConfiguration} from "./PerpMarketFactoryConfiguration.sol";
import {PerpCollateral} from "./PerpCollateral.sol";

/**
 * @dev An open position on a specific perp market within bfp-market.
 *
 * TODO: Rename to PerpPosition
 */
library Position {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using PerpMarket for PerpMarket.Data;

    // --- Structs --- //

    struct TradeParams {
        int128 sizeDelta;
        uint256 oraclePrice;
        uint256 fillPrice;
        uint128 makerFee;
        uint128 takerFee;
        uint256 limitPrice;
    }

    // --- Storage --- //

    struct Data {
        // Owner of position.
        uint128 accountId;
        // Market this position belongs to (e.g. wstETHPERP)
        uint128 marketId;
        // Size (in native units e.g. wstETH)
        int128 size;
        // The market's accumulated accrued funding at position open.
        int128 entryFundingValue;
        // The fill price at which this position was opened with.
        uint256 entryPrice;
        // Cost in USD to open this positions (e.g. keeper + order fees).
        uint256 feesIncurredUsd;
    }

    /**
     * @dev Given an open position (same account) and trade params return the subsequent position.
     *
     * Keeping this as postTradeDetails (same as perps v2) until I can figure out a better name.
     */
    function postTradeDetails(
        uint128 marketId,
        Position.Data storage currentPosition,
        TradeParams memory params
    ) internal returns (Position.Data memory position, uint256 fee, uint256 keeperFee) {
        if (params.sizeDelta == 0) {
            revert Error.NilOrder();
        }

        // TODO: Check if the `currentPosition` can be liquidated, if so, revert.

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        int128 skew = market.skew;
        uint128 skewScale = market.skewScale;

        uint256 oraclePrice = market.assetPrice();
        uint256 fillPrice = Order.fillPrice(skew, skewScale, params.sizeDelta, oraclePrice);

        fee = Order.orderFee(params.sizeDelta, fillPrice, skew, params.makerFee, params.takerFee);
        keeperFee = Order.keeperFee(market.minKeeperFeeUsd, market.maxKeeperFeeUsd);

        // Determine if the resulting position will _not_ be in a bad place (i.e. instant liquidation).
        //
        // We do this by inferring the `remainingMargin = (sum(collateral * price)) + pnl + fundingAcrrued - fee` such that
        // if remainingMargin < minMarginThreshold then this must revert.
        //
        // NOTE: The use of fillPrice and not oraclePrice to perform calculations below.
        int256 _remainingMargin = remainingMargin(currentPosition, fillPrice);

        if (_remainingMargin < 0) {
            revert Error.InsufficientMargin();
        }

        // TODO: Replace this with a real position to be returned upon success postTradeDetails.
        position = Position.Data({
            accountId: 0,
            marketId: marketId,
            size: 0,
            entryFundingValue: 0,
            entryPrice: 0,
            feesIncurredUsd: 0
        });
    }

    // --- Memebr --- //

    /**
     * @dev Returns a position's accrued funding.
     */
    function accruedFunding(Position.Data storage self, uint256 price) internal view returns (int256) {
        if (self.size == 0) {
            return 0;
        }

        PerpMarket.Data storage market = PerpMarket.load(self.marketId);
        int256 netFundingPerUnit = market.nextFunding(price) - self.entryFundingValue;
        return self.size * netFundingPerUnit;
    }

    /**
     * @dev Returns the `sum(p.collaterals.map(c => c.amount * c.price))`.
     */
    function collateralUsd(Position.Data storage self) internal view returns (uint256) {
        PerpMarketFactoryConfiguration.Data storage config = PerpMarketFactoryConfiguration.load();

        uint256 collateralValueUsd = 0;
        uint256 length = config.supportedCollateral.length;
        PerpCollateral.Data storage collaterals = PerpCollateral.load(self.accountId, self.marketId);

        PerpMarketFactoryConfiguration.Collateral memory currentCollateral;
        for (uint256 i = 0; i < length; ) {
            currentCollateral = config.supportedCollateral[i];

            uint256 price = INodeModule(config.oracleManager).process(currentCollateral.oracleNodeId).price.toUint();
            collateralValueUsd += collaterals.collateral[currentCollateral.collateral] * price;

            unchecked {
                i++;
            }
        }

        return collateralValueUsd;
    }

    /**
     * @dev Return a position's remaining margin.
     *
     * The remaining margin is defined as sum(collateral * price) + PnL + funding in USD.
     *
     * We return an `int` here as after all fees and PnL, this can be negative. The caller should verify that this
     * is positive before proceeding with further operations.
     */
    function remainingMargin(Position.Data storage self, uint256 price) internal view returns (int256) {
        int256 margin = collateralUsd(self).toInt();
        int256 funding = accruedFunding(self, price);

        // Calculcate this position's PnL
        int256 priceDelta = price.toInt() - self.entryPrice.toInt();
        int256 pnl = self.size * priceDelta;

        return margin + pnl + funding;
    }
}
