//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

/**
 * Market Distribution is set by assigning weights to markets
 * the proportion for a market is obtained as market_distribution / totalWeights
 * where totalWeights is the sum of all MarketDistribution weights
 */
library MarketDistribution {
    struct Data {
        /// @dev market baked by this pool
        uint128 market;
        /// @dev weight sent to that market
        uint128 weight;
        /// @dev cap on debt exposure for the market
        int128 maxDebtShareValue;
    }
}
