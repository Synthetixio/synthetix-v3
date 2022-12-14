//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

library Fee {
    using DecimalMath for uint256;

    enum TradeType {
        BUY,
        SELL,
        WRAP,
        UNWRAP
    }

    struct Data {
        uint interestRate;
        uint fixedFee;
        uint skewScale;
        uint skewFeePercentage; // in bips
        uint[] utilizationThresholds;
        uint utilizationFeeRate; // in bips
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Fee", marketId));
        assembly {
            store.slot := s
        }
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
