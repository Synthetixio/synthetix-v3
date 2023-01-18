//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./Fee.sol";
import "./AsyncOrderConfiguration.sol";

library AsyncOrderClaim {
    struct Data {
        SpotMarketFactory.TransactionType orderType;
        uint256 amountEscrowed; // Amount escrowed from trader. (USD denominated on buy. Synth denominated on sell.)
        uint256 settlementStrategyId;
        uint256 settlementTime;
        int256 utilizationDelta;
        uint256 cancellationFee;
    }
}
