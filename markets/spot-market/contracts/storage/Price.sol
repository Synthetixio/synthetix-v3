//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/oracle-manager/contracts/interfaces/IOracleManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "./SpotMarketFactory.sol";
import "./Fee.sol";

library Price {
    using DecimalMath for uint256;
    using SafeCastI256 for int256;

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

    function getCurrentPrice(
        Data storage self,
        Fee.TradeType tradeType
    ) internal view returns (uint256 price) {
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        if (tradeType == Fee.TradeType.BUY) {
            price = IOracleManagerModule(factory.oracle).process(self.buyFeedId).price.toUint();
        } else {
            price = IOracleManagerModule(factory.oracle).process(self.sellFeedId).price.toUint();
        }
    }

    function update(Data storage self, bytes32 buyFeedId, bytes32 sellFeedId) internal {
        self.buyFeedId = buyFeedId;
        self.sellFeedId = sellFeedId;
    }

    function usdSynthExchangeRate(
        Data storage self,
        uint amountUsd,
        Fee.TradeType tradeType
    ) internal view returns (uint256 synthAmount) {
        uint256 currentPrice = getCurrentPrice(self, tradeType);
        synthAmount = amountUsd.divDecimal(currentPrice);
    }

    function synthUsdExchangeRate(
        Data storage self,
        uint sellAmount,
        Fee.TradeType tradeType
    ) internal view returns (uint256 amountUsd) {
        uint256 currentPrice = getCurrentPrice(self, tradeType);
        amountUsd = sellAmount.mulDecimal(currentPrice);
    }
}
