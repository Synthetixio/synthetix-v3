//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/oracle-manager/contracts/interfaces/IOracleManagerModule.sol";
import "@synthetixio/oracle-manager/contracts/storage/Node.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "./SpotMarketFactory.sol";
import "../utils/SynthUtil.sol";
import "./Fee.sol";
import "./Wrapper.sol";

library Price {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    struct Data {
        bytes32 buyFeedId;
        bytes32 sellFeedId;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Price", marketId));
        assembly {
            store.slot := s
        }
    }

    // TODO: Let's just make this a mapping of overrides for transaction types
    function getCurrentPriceData(
        uint128 marketId,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (Node.Data memory price) {
        Data storage self = load(marketId);
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        if (transactionType == SpotMarketFactory.TransactionType.BUY) {
            price = IOracleManagerModule(factory.oracle).process(self.buyFeedId);
        } else {
            price = IOracleManagerModule(factory.oracle).process(self.sellFeedId);
        }
    }

    function getCurrentPrice(
        uint128 marketId,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (uint price) {
        return getCurrentPriceData(marketId, transactionType).price.toUint();
    }

    function update(Data storage self, bytes32 buyFeedId, bytes32 sellFeedId) internal {
        self.buyFeedId = buyFeedId;
        self.sellFeedId = sellFeedId;
    }

    function usdSynthExchangeRate(
        uint128 marketId,
        uint amountUsd,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (uint256 synthAmount) {
        uint256 currentPrice = getCurrentPriceData(marketId, transactionType).price.toUint();

        synthAmount = amountUsd.divDecimal(currentPrice);
    }

    function synthUsdExchangeRate(
        uint128 marketId,
        uint sellAmount,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (uint256 amountUsd) {
        uint256 currentPrice = getCurrentPrice(marketId, transactionType);
        amountUsd = sellAmount.mulDecimal(currentPrice);
    }
}
