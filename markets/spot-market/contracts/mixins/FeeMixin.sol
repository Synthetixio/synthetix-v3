//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/SpotMarketStorage.sol";
import "../interfaces/ISpotMarketFee.sol";

contract FeeMixin {
    function _processFees(
        SpotMarketStorage.SpotMarketStore storage store,
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
