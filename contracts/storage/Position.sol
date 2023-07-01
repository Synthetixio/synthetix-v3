//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @dev An open position on a specific perp market within bfp-market.
 */
library Position {
    struct Data {
        uint128 accountId;
        int128 size;
        int128 entryFundingValue;
        uint256 entryPrice;
        uint256 feesIncurredUsd;
    }
}
