//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IBasePerpMarket} from "./IBasePerpMarket.sol";
import {Position} from "../storage/Position.sol";
import {Order} from "../storage/Order.sol";

interface IOrderModule is IBasePerpMarket {
    // --- Structs --- //

    struct OrderDigest {
        /// Size to modify when settled
        int128 sizeDelta;
        /// block.timestamp of when the order was committed
        uint256 commitmentTime;
        /// The max acceptable price tolerance for settlement
        uint256 limitPrice;
        /// A tip in USD to pay for settlement keepers
        uint256 keeperFeeBufferUsd;
        /// A list of whitelisted hook addresses to invoke after settlement
        address[] hooks;
        /// True if order expired and must be canceled, false otherwise
        bool isStale;
        /// True if order can be settled, false otherwise
        bool isReady;
    }

    // --- Events --- //

    /// @notice Emitted when an order is committed.
    /// @param accountId Account the order belongs to
    /// @param marketId Market the order was committed against
    /// @param commitmentTime block.timestamp of commitment
    /// @param sizeDelta Size to modify on the existing or new position after settlement
    /// @param estimatedOrderFee Projected fee paid to open order at the time of commitment
    /// @param estimatedKeeperFee Projected fee paid to keepers at the time of commitment
    event OrderCommitted(
        uint128 indexed accountId,
        uint128 indexed marketId,
        uint256 commitmentTime,
        int128 sizeDelta,
        uint256 estimatedOrderFee,
        uint256 estimatedKeeperFee
    );

    /// @notice Emitted when a pending order was successfully settled.
    /// @param accountId Account of the settled order
    /// @param marketId Market of the settled order
    /// @param settlementTime block.timestamp when order was settled
    /// @param sizeDelta Size to modify, applied on the new or existing position
    /// @param orderFee Actual fee paid to settle order
    /// @param keeperFee Actual fee paid to keeper to settle order
    /// @param accruedFunding Realized funding accrued on existing position before settlement
    /// @param accruedUtilization Realized utilization accrued on existing position before settlement
    /// @param pnl Realized price PnL on existing position before settlement
    /// @param accountDebt Debt due to position realization after settlement
    event OrderSettled(
        uint128 indexed accountId,
        uint128 indexed marketId,
        uint256 settlementTime,
        int128 sizeDelta,
        uint256 orderFee,
        uint256 keeperFee,
        int256 accruedFunding,
        uint256 accruedUtilization,
        int256 pnl,
        uint256 fillPrice,
        uint128 accountDebt
    );

    /// @notice Emitted after an order is settled with hook(s) and the hook was completely successfully.
    /// @param accountId Account of order that was settled before hook was executed
    /// @param marketId Market of order that was settled before hook was executed
    /// @param hook Address of the executed settlement hook
    event OrderSettlementHookExecuted(
        uint128 indexed accountId,
        uint128 indexed marketId,
        address hook
    );

    // --- Mutations --- //

    /**
     * @notice Creates an order for `accountId` in `marketId` to be settled at a later time.
     */
    function commitOrder(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta,
        uint256 limitPrice,
        uint256 keeperFeeBufferUsd,
        address[] memory hooks
    ) external;

    /**
     * @notice Settles a previously committed order by `accountId` and `marketId`.
     */
    function settleOrder(
        uint128 accountId,
        uint128 marketId,
        bytes calldata priceUpdateData
    ) external payable;

    /**
     * @notice Cancel a previously committed order by `accountId` and `marketId`.
     *
     * This can only happen after an order is ready and a keeper can prove price tolerance has been exceeded.
     * If the order is stale only the owner is allowed to cancel
     */
    function cancelOrder(
        uint128 accountId,
        uint128 marketId,
        bytes calldata priceUpdateData
    ) external payable;

    /**
     * @notice Cancels a previously committed order that has gone stale by `accountId` and `marketId`.
     *
     * This can only happen after an order is stale, and not settled or canceled by a keeper.
     * It's added a conviennt method to clear stale orders without having to provide a price update
     */
    function cancelStaleOrder(uint128 accountId, uint128 marketId) external;

    // --- Views --- //

    /**
     * @notice Returns an order belonging to `accountId` in `marketId`.
     */
    function getOrderDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IOrderModule.OrderDigest memory);

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
