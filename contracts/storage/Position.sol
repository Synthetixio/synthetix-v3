//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @dev An open position on a specific perp market within bfp-market.
 */
library Position {
    // --- Structs --- //

    struct TradeParams {
        int128 sizeDelta;
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
     */
    function simulateTrade(
        Data storage currentPosition,
        TradeParams memory params
    ) internal returns (Data memory position, uint256 fee) {}
}
