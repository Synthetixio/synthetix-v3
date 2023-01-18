//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "./SpotMarketFactory.sol";
import "../utils/SynthUtil.sol";
import "./Fee.sol";
import "./Wrapper.sol";

/**
 * @title Price storage for a specific synth market.
 */
library Price {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    struct Data {
        /**
         * @dev The oracle manager node id used for buy transactions.
         * currently used for calculating reported debt as well.
         */
        bytes32 buyFeedId;
        /**
         * @dev The oracle manager node id used for all non-buy transactions.
         */
        bytes32 sellFeedId;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Price", marketId));
        assembly {
            store.slot := s
        }
    }

    /**
     * @dev Returns the current price data for the given transaction type.
     * NodeOutput.Data is a struct from oracle manager containing the price, timestamp among others.
     */
    function getCurrentPriceData(
        uint128 marketId,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (NodeOutput.Data memory price) {
        Data storage self = load(marketId);
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        if (transactionType == SpotMarketFactory.TransactionType.BUY) {
            price = INodeModule(factory.oracle).process(self.buyFeedId);
        } else {
            price = INodeModule(factory.oracle).process(self.sellFeedId);
        }
    }

    /**
     * @dev Same as getCurrentPriceData but returns only the price.
     */
    function getCurrentPrice(
        uint128 marketId,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (uint price) {
        return getCurrentPriceData(marketId, transactionType).price.toUint();
    }

    /**
     * @dev Updates price feeds.  Function resides in SpotMarketFactory to update these values.
     * Only market owner can update these values.
     */
    function update(Data storage self, bytes32 buyFeedId, bytes32 sellFeedId) internal {
        self.buyFeedId = buyFeedId;
        self.sellFeedId = sellFeedId;
    }

    /**
     * @dev Utility function that returns the amount of synth to be received for a given amount of usd.
     * Based on the transaction type, either the buy or sell feed node id is used.
     */
    function usdSynthExchangeRate(
        uint128 marketId,
        uint amountUsd,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (uint256 synthAmount) {
        uint256 currentPrice = getCurrentPriceData(marketId, transactionType).price.toUint();

        synthAmount = amountUsd.divDecimal(currentPrice);
    }

    /**
     * @dev Utility function that returns the amount of usd to be received for a given amount of synth.
     * Based on the transaction type, either the buy or sell feed node id is used.
     */
    function synthUsdExchangeRate(
        uint128 marketId,
        uint sellAmount,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (uint256 amountUsd) {
        uint256 currentPrice = getCurrentPrice(marketId, transactionType);
        amountUsd = sellAmount.mulDecimal(currentPrice);
    }
}
