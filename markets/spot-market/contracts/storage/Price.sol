//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {NodeOutput} from "@synthetixio/oracle-manager/contracts/storage/NodeOutput.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SpotMarketFactory} from "./SpotMarketFactory.sol";
import {Transaction} from "../utils/TransactionUtil.sol";

/**
 * @title Price storage for a specific synth market.
 */
library Price {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;

    struct Data {
        /**
         * @dev The oracle manager node id used for buy transactions.
         */
        bytes32 buyFeedId;
        /**
         * @dev The oracle manager node id used for all non-buy transactions.
         * @dev also used to for calculating reported debt
         */
        bytes32 sellFeedId;
    }

    function load(uint128 marketId) internal pure returns (Data storage price) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Price", marketId));
        assembly {
            price.slot := s
        }
    }

    /**
     * @dev Returns the current price data for the given transaction type.
     * NodeOutput.Data is a struct from oracle manager containing the price, timestamp among others.
     */
    function getCurrentPriceData(
        uint128 marketId,
        Transaction.Type transactionType
    ) internal view returns (NodeOutput.Data memory price) {
        Data storage self = load(marketId);
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        if (Transaction.isBuy(transactionType)) {
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
        Transaction.Type transactionType
    ) internal view returns (uint256 price) {
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
        uint256 amountUsd,
        Transaction.Type transactionType
    ) internal view returns (uint256 synthAmount) {
        uint256 currentPrice = getCurrentPrice(marketId, transactionType);
        synthAmount = amountUsd.divDecimal(currentPrice);
    }

    /**
     * @dev Utility function that returns the amount of usd to be received for a given amount of synth.
     * Based on the transaction type, either the buy or sell feed node id is used.
     */
    function synthUsdExchangeRate(
        uint128 marketId,
        uint256 sellAmount,
        Transaction.Type transactionType
    ) internal view returns (uint256 amountUsd) {
        uint256 currentPrice = getCurrentPrice(marketId, transactionType);
        amountUsd = sellAmount.mulDecimal(currentPrice);
    }

    /**
     * @dev Utility function that returns the amount denominated with 18 decimals of precision.
     */
    function scale(int256 amount, uint256 decimals) internal pure returns (int256 scaledAmount) {
        return (decimals > 18 ? amount.downscale(decimals - 18) : amount.upscale(18 - decimals));
    }

    /**
     * @dev Utility function that receive amount with 18 decimals
     * returns the amount denominated with number of decimals as arg of 18.
     */
    function scaleTo(int256 amount, uint256 decimals) internal pure returns (int256 scaledAmount) {
        return (decimals > 18 ? amount.upscale(decimals - 18) : amount.downscale(18 - decimals));
    }
}
