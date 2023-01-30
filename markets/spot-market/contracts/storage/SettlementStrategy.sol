//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library SettlementStrategy {
    struct Data {
        Type strategyType;
        uint256 settlementDelay;
        uint256 settlementWindowDuration;
        address priceVerificationContract; // For Chainlink and Pyth settlement strategies
        uint256 feedId;
        /*
            - **Price Deviation Circuit Breaker Node ID** - For Chainlink and Pyth settlement strategies. _t.b.d._
            - **Price Deviation Circuit Breaker Tolerance** - For Chainlink and Pyth settlement strategies. _t.b.d._
        */
    }

    enum Type {
        ONCHAIN,
        CHAINLINK,
        PYTH
    }
}
