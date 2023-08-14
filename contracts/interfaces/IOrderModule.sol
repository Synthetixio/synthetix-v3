//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./IBasePerpMarket.sol";
import {Order} from "../storage/Order.sol";

interface IOrderModule is IBasePerpMarket {
    // --- Events --- //

    // @dev Emitted when a new order is submitted/created.
    event OrderSubmitted(
        uint128 indexed accountId,
        uint128 indexed marketId,
        int256 sizeDelta,
        uint256 commitmentTime,
        uint256 estimatedOrderFee,
        uint256 estimatedKeeperFee
    );

    // @dev Emitted when a pending order was successfully settled/executed.
    event OrderSettled(
        uint128 indexed accountId,
        uint128 indexed marketId,
        int256 sizeDelta,
        uint256 orderFee,
        uint256 keeperFee
    );

    // @dev Emitted when a stale order was canceled.
    event OrderCanceled(
        uint128 indexed accountId,
        uint128 indexed marketId,
        int256 sizeDelta,
        uint256 orderFee,
        uint256 keeperFee
    );

    // --- Mutative --- //

    /**
     * @dev Creates an order to be submitted for settlement.
     */
    function commitOrder(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta,
        uint256 limitPrice,
        uint256 keeperFeeBufferUsd
    ) external;

    /**
     * @dev Given an accountId, find the associated market by `marketId` and settles the order.
     */
    function settleOrder(uint128 accountId, uint128 marketId, bytes[] calldata priceUpdateData) external payable;

    /**
     * @dev Cancels a pending order.
     *
     * An order can only be canceled after a certain amount of time (i.e. when an order becomes stale). The keeperFee
     * is not charged if the caller is the same owner as the order.
     */
    function cancelOrder(uint128 accountId, uint128 marketId) external;

    // --- Views --- //

    /**
     * @dev Returns the order belonging to `accountId` in `marketId`.
     */
    function getOrder(uint128 accountId, uint128 marketId) external view returns (Order.Data memory);

    /**
     * @dev Given details about a trader, simulate a what would happen if the order were to be committed.
     */
    function simulateOrder(
        uint128 accountId,
        uint128 marketId,
        uint128 sizeDelta,
        uint256 limitPrice,
        uint256 keeperFeeBufferUsd,
        uint256 oraclePrice
    ) external view;

    /**
     * @dev Returns fee charged to open/close an order and keeperFee.
     *
     * This incorporates the scenario where a if a trade flips the skew, the proportion that reduces the skew
     * is charged a makerFee but the flipped side that expands skew is charged a takerFee.
     *
     * For the keeper fee, calculation is as follows `orderSettlementGasUnits * block.basefee * ETH/USD + bufferUsd.
     * Which, can roughly be related to (units * baseFee) / 10e9 * oraclePrice.
     *
     * The keeper fee is then bounded between a configurable min/max and a buffer is then provided.
     */
    function getOrderFees(
        uint128 marketId,
        int128 sizeDelta,
        uint256 keeperFeeBufferUsd
    ) external view returns (uint256 orderFee, uint256 keeperFee);

    /**
     * @dev Returns an oracle price adjusted by a premium/discount based on how the sizeDelta effects skew.
     *
     * 'Fill' can be attributed or when an order is 'filled'. The price is the oracle price + adjustment when
     * which an order is settled. Intuitively, the adjustment is a discount if the size reduces the skew (i.e. skew
     * is pulled closer to zero). However a premium is applied if skew expands (i.e. skew pushed away from zero).
     *
     * More can be read in SIP-279.
     */
    function getFillPrice(uint128 marketId, int128 size) external view returns (uint256);

    /**
     * @dev Returns the oracle price given the `marketId`.
     */
    function getOraclePrice(uint128 marketId) external view returns (uint256);
}
