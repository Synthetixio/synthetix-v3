//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

library Fee {
    using MathUtil for uint256;

    enum TradeType {
        BUY,
        SELL,
        WRAP,
        UNWRAP
    }

    struct Data {
        uint interestRate;
        uint fixedFee;
    }

    function calculateFees(
        Data storage self,
        address transactor,
        uint amount,
        TradeType tradeType
    ) internal view returns (uint amountUsable, uint feesCollected) {
        feesCollected = amount.mulDecimal(self.fixedFee).divDecimal(10000);
        amountUsable = amount - feesCollected;
    }
}
