//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./FeeUtil.sol";
import "./SynthUtil.sol";

library OrderUtil {
    function settleBuy(
        uint128 marketId,
        uint256 usdAmount,
        SpotMarketFactory.Data storage spotMarketFactory,
        uint256 minAmountReceived
    ) internal returns (uint finalAmount, int totalFees, uint collectedFees) {
        // Calculate fees
        (uint256 amountUsable, totalFees, collectedFees) = FeeUtil.processFees(
            marketId,
            msg.sender,
            usdAmount,
            Price.getCurrentPrice(marketId, SpotMarketFactory.TransactionType.BUY),
            SpotMarketFactory.TransactionType.BUY
        );

        spotMarketFactory.depositToMarketManager(marketId, amountUsable);

        // Exchange amount after fees into synths to buyer
        finalAmount = Price.usdSynthExchangeRate(
            marketId,
            amountUsable,
            SpotMarketFactory.TransactionType.BUY
        );

        if (finalAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, finalAmount);
        }

        SynthUtil.getToken(marketId).mint(msg.sender, finalAmount);
    }
}
