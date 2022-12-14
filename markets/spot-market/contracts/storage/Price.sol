//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";

library Price {
    using DecimalMath for uint256;

    struct Data {
        bytes buyFeedId;
        bytes sellFeedId;
    }

    // TODO: interact with OracleManager to get price for market synth
    function getCurrentPrice(Data storage self) internal pure returns (uint) {
        /* get from oracleManager / aggregator chainlink based on synth id */
        return 1;
    }

    function usdSynthExchangeRate(
        Data storage self,
        uint amountUsd
    ) internal pure returns (uint synthAmount) {
        uint currentPrice = getCurrentPrice(self);
        synthAmount = amountUsd.divDecimal(currentPrice);
    }

    function synthUsdExchangeRate(
        Data storage self,
        uint sellAmount
    ) internal pure returns (uint amountUsd) {
        uint currentPrice = getCurrentPrice(self);
        amountUsd = sellAmount.mulDecimal(currentPrice);
    }
}
