//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Stores information regarding a pool's relationship to a market, such that it can be added or removed from a distribution
 */
library MarketPoolInfo {
    struct Data {
        /**
         * @dev The credit capacity that this pool is providing to the relevant market. Needed to re-add the pool to the distribution when going back in range.
         */
        uint128 creditCapacityAmountD18;
        /**
         * @dev The amount of debt the pool has which hasn't been passed down the debt distribution chain yet.
         */
        uint128 pendingDebtD18;
    }
}
