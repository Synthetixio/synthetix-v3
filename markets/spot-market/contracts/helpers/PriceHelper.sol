//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "../storage/SpotMarket.sol";
import "../interfaces/ISpotMarketFee.sol";

contract PriceHelper {
    using DecimalMath for uint256;

    // TODO: change from pure once _getCurrentPrice is implemented
    function _synthUsdExchangeRate(uint sellAmount) internal pure returns (uint amountUsd) {
        uint currentPrice = _getCurrentPrice();
        amountUsd = sellAmount.mulDecimal(currentPrice);
    }

    function _usdSynthExchangeRate(uint amountUsd) internal pure returns (uint synthAmount) {
        uint currentPrice = _getCurrentPrice();
        synthAmount = amountUsd.divDecimal(currentPrice);
    }

    function _quote(
        SpotMarket.Data storage store,
        uint amountUsd,
        ISpotMarketFee.TradeType tradeType
    ) internal view returns (uint, uint) {
        return ISpotMarketFee(store.feeManager).getFeesQuote(msg.sender, store.marketId, amountUsd, tradeType);
    }

    // TODO: interact with OracleManager to get price for market synth
    function _getCurrentPrice() internal pure returns (uint) {
        /* get from oracleManager / aggregator chainlink based on synth id */
        return 1;
    }
}
