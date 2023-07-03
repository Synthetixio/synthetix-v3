//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Error} from "./Error.sol";

/**
 * @dev An open position on a specific perp market within bfp-market.
 */
library Position {
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
     * @dev Given an open position (same account) and trade params return the subsequent position.
     *
     * Keeping this as postTradeDetails (same as perps v2) until I can figure out a better name.
     */
    function postTradeDetails(
        Data storage currentPosition,
        TradeParams memory params
    ) internal returns (Data memory position, uint256 fee) {
        if (params.sizeDelta == 0) {
            revert Error.NilOrder();
        }

        // TODO: Check if the `currentPosition` can be liquidated, if so, revert.
    }
}
