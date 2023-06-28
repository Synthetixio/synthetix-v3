//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library Position {
    struct Data {
        int128 size;
        int128 entryFundingValue;
        uint256 entryPrice;
        uint256 feesIncurredUsd;
    }
}
