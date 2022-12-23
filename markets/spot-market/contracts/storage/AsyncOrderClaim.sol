//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Fee.sol";

// Not sure this is the correct name for this, more like AsyncOrderManager
library AsyncOrderClaim {
    struct Data {
        SpotMarketFactory.TransactionType orderType;
        uint256 synthAmountEscrowed; // traderAmountEscrowed
        uint256 usdAmountEscrowed; // marketAmountEscrowed
        uint256 blockNumber;
        uint256 timestamp;
    }
}
