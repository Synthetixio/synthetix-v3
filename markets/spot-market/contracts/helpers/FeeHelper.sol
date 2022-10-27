//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/SpotMarket.sol";
import "../interfaces/ISpotMarketFee.sol";

contract FeeHelper {
    function _processFees(
        SpotMarket.Data storage store,
        uint amountUsd,
        ISpotMarketFee.TradeType tradeType
    ) internal returns (uint amountUsable, uint feesCollected) {
        store.usdToken.approve(store.feeManager, amountUsd);
        (amountUsable, feesCollected) = ISpotMarketFee(store.feeManager).processFees(
            msg.sender,
            store.marketId,
            amountUsd,
            tradeType
        );
    }
}
