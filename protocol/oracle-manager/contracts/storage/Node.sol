//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Node {
    struct Data {
        int256 price;
        uint timestamp;
        uint volatilityScore;
        uint liquidityScore;
    }
}
