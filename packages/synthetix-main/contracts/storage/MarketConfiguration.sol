//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

/**
 * @title Tracks a market's weight within a Pool, and its maximum debt.
 *
 * Each pool has an array of these, with one entry per market managed by the pool.
 *
 * A market's weight determines how much liquidity the pool provides to the market, and how much debt exposure the market gives the pool.
 *
 * Weights are used to calculate percentages by adding all the weights in the pool and dividing the market's weight by the total weights.
 *
 * A market's maximum debt in a pool is indicated with a maximum debt value per share.
 */
library MarketConfiguration {
    struct Data {
        /**
         * @dev TODO
         *
         * TODO: Rename to marketId?
         */
        /// @dev market baked by this pool
        uint128 market;
        /**
         * @dev TODO
         */
        /// @dev weight sent to that market
        uint128 weight;
        /**
         * @dev TODO
         *
         * Should be within [0, 1].
         *
         * TODO: Confirm range above.
         * TODO: Make sure whenever it is set to enforce this.
         */
        /// @dev cap on debt exposure for the market
        int128 maxDebtShareValue;
    }
}
