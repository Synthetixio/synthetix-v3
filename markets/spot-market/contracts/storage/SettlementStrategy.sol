//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library SettlementStrategy {
    struct Data {
        Type strategyType;
        uint256 settlementDelay;
        uint256 settlementWindowDuration;
        address priceVerificationContract; // For Chainlink and Pyth settlement strategies
        bytes32 feedId;
        string url;
        uint256 keepersReward;
        uint256 priceDeviationThreshold;
    }

    enum Type {
        ONCHAIN,
        CHAINLINK,
        PYTH
    }
}
