//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";

/**
 * @title Module for processing orders from the offchain orderbook
 */
interface IBookOrderModule {
    /**
     * @notice An order being settled by the orderbook.
     */
    struct BookOrder {
        /**
         * @dev Order account id.
         */
        uint128 accountId;
        /**
         * @dev Order size delta (of asset units expressed in decimal 18 digits). It can be positive or negative.
         */
        int128 sizeDelta;
        /**
         * @dev The price that should be used to fill the order
         */
        uint256 orderPrice;
        /**
         * @dev The price that should be used for this order.
         * It should be signed by a trusted price provider for the perps market.
         * This field is optional and can be 0x. If this is the case, the next order(s) must be of oposite magnitude to match this order.
         */
        bytes signedPriceData;
        /**
         * @dev An optional code provided by frontends to assist with tracking the source of volume and fees.
         */
        bytes32 trackingCode;
    }

		event BookOrderSettled(uint128 indexed marketId, BookOrder[] orders, uint256 totalCollectedFees);

    /**
     * @notice Indicates a summary as to the operation state of a subbmitted order for settlement
     */
    enum OrderStatus {
        FILLED,
        CANCELLED
    }

    /**
     * @notice Returned by `settleBookOrders` to indicate the result of a submitted order for settlement
     */
    struct BookOrderSettleStatus {
        /**
         * @dev The result of the order
         */
        OrderStatus status;
    }

    /**
     * @notice Called by the offchain orderbook to settle a prevoiusly placed order onchain. Any orders submitted to this function will be processed as if they happened simultaneously, at the prices given by the orderbook.
     * If an order is found to be unfillable (ex. insufficient account liquidity), it will be returned in the `statuses` return field.
     * @param marketId the market for which all of the following orders should be operated on
     * @param orders the list of orders to settle
     * @return statuses the result of the `orders` supplied to this function.
     */
    function settleBookOrders(
        uint128 marketId,
        BookOrder[] memory orders
    ) external returns (BookOrderSettleStatus[] memory statuses);
}
