//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Error} from "./Error.sol";
import {Order} from "./Order.sol";
import {PerpMarket} from "./PerpMarket.sol";

/**
 * @dev An open position on a specific perp market within bfp-market.
 */
library Position {
    using PerpMarket for PerpMarket.Data;

    // --- Structs --- //

    struct TradeParams {
        int128 sizeDelta;
        uint256 oraclePrice;
        uint256 fillPrice;
        uint128 makerFee;
        uint128 takerFee;
        uint256 desiredFillPrice;
    }

    // --- Storage --- //

    struct Data {
        // Owner of position.
        uint128 accountId;
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
     * @dev Return a position's 'remaining margin' in the form: (collateral * price) + pnl + funding in USD.
     */
    function computeMarginPlusProfitFunding(
        Data storage currentPosition,
        uint oraclePrice
    ) internal view returns (int256) {}

    /**
     * @dev Given an open position (same account) and trade params return the subsequent position.
     *
     * Keeping this as postTradeDetails (same as perps v2) until I can figure out a better name.
     */
    function postTradeDetails(
        uint128 marketId,
        Data storage currentPosition,
        TradeParams memory params
    ) internal returns (Data memory position, uint256 fee) {
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
    }
}
