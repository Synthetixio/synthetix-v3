//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Interface a market's fee manager needs to adhere to.
interface ISpotMarketFee {
    enum TradeType {
        BUY,
        SELL,
        WRAP,
        UNWRAP
    }

    function processFees(
        address transactor,
        uint marketId,
        uint amount,
        TradeType tradeDirection
    ) external returns (uint amountUsable, uint feesCollected);

    function getFeesQuote(
        address transactor,
        uint marketId,
        uint amount,
        TradeType tradeType
    ) external view returns (uint amountUsable, uint feesCollected);
}
