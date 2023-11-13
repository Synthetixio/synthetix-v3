//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IBasePerpMarket.sol";
import {Position} from "../storage/Position.sol";
import {Order} from "../storage/Order.sol";

interface IOrderModule is IBasePerpMarket {
    // --- Events --- //

    // @notice Emitted when an order is committed.
    event OrderCommitted(
        uint128 indexed accountId,
        uint128 indexed marketId,
        uint256 commitmentTime,
        int128 sizeDelta,
        uint256 estimatedOrderFee,
        uint256 estimatedKeeperFee
    );

    // @notice Emitted when a pending order was successfully settled.
    event OrderSettled(
        uint128 indexed accountId,
        uint128 indexed marketId,
        uint256 settlementTime,
        int128 sizeDelta,
        uint256 orderFee,
        uint256 keeperFee,
        int256 accruedFunding,
        int256 pnl,
        uint256 fillPrice
    );

    // --- Mutative --- //

    /**
     * @notice Creates an order for `accountId` in `marketId` to be settled at a later time.
     */
    function commitOrder(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta,
        uint256 limitPrice,
        uint256 keeperFeeBufferUsd
    ) external;

    /**
     * @notice Settles a previously committed order by `accountId` and `marketId`.
     */
    function settleOrder(uint128 accountId, uint128 marketId, bytes calldata priceUpdateData) external payable;

    /**
     * @notice Cancel a previously committed order by `accountId` and `marketId`.
     * This can only happen after an order is ready and a keeper can prove price tolerance has been exceeded.
     * If the order is stale only the owner is allowed to cancel
     */
    function cancelOrder(uint128 accountId, uint128 marketId, bytes calldata priceUpdateData) external payable;

    // --- Views --- //

    /**
     * @notice Returns an order belonging to `accountId` in `marketId`.
     */
    function getOrderDigest(uint128 accountId, uint128 marketId) external view returns (Order.Data memory);

    /**
     * @notice Returns fees charged to open/close an order (along with a dynamic keeper fee).
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
     * @notice Returns an oracle price adjusted by a premium/discount based on how the sizeDelta effects skew.
     *
     * 'Fill' can be attributed or when an order is 'filled'. The price is the oracle price + adjustment when
     * which an order is settled. Intuitively, the adjustment is a discount if the size reduces the skew (i.e. skew
     * is pulled closer to zero). However a premium is applied if skew expands (i.e. skew pushed away from zero).
     *
     * More can be read in SIP-279.
     */
    function getFillPrice(uint128 marketId, int128 size) external view returns (uint256);

    /**
     * @notice Returns the oracle price given the `marketId`.
     */
    function getOraclePrice(uint128 marketId) external view returns (uint256);
}
