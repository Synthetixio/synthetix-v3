//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/oracle-manager/contracts/interfaces/IOracleManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "./SpotMarketFactory.sol";
import "./Fee.sol";

library Price {
    using DecimalMath for uint256;
    using DecimalMath for int256;

    struct Data {
        bytes32 buyFeedId;
        bytes32 sellFeedId;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Price", marketId));
        assembly {
            store.slot := s
        }
    }

    // TODO: interact with OracleManager to get price for market synth
    function getCurrentPrice(
        Data storage self,
        Fee.TradeType tradeType
    ) internal view returns (int256 price) {
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        if (tradeType == Fee.TradeType.BUY) {
            price = IOracleManagerModule(factory.oracle).process(self.buyFeedId).price;
        } else {
            price = IOracleManagerModule(factory.oracle).process(self.sellFeedId).price;
        }
    }

    function update(Data storage self, bytes32 buyFeedId, bytes32 sellFeedId) internal {
        self.buyFeedId = buyFeedId;
        self.sellFeedId = sellFeedId;
    }

    function usdSynthExchangeRate(
        Data storage self,
        int amountUsd,
        Fee.TradeType tradeType
    ) internal view returns (int256 synthAmount) {
        int256 currentPrice = getCurrentPrice(self, tradeType);
        synthAmount = int256(amountUsd).divDecimal(currentPrice);
    }

    function synthUsdExchangeRate(
        Data storage self,
        int sellAmount,
        Fee.TradeType tradeType
    ) internal view returns (int256 amountUsd) {
        int256 currentPrice = getCurrentPrice(self, tradeType);
        amountUsd = int256(sellAmount).mulDecimal(currentPrice);
    }
}
