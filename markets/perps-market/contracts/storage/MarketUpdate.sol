//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title MarketUpdateData
 */
library MarketUpdate {
    // this data struct returns the data required to emit a MarketUpdated event
    struct Data {
        uint128 marketId;
        uint128 interestRate;
        int256 skew;
        uint256 size;
        int256 currentFundingRate;
        int256 currentFundingVelocity;
    }
}
