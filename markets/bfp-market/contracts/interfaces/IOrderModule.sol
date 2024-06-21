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
        uint64 commitmentTime;
        /// The max acceptable price tolerance for settlement
        uint256 limitPrice;
        /// A tip in USD to pay for settlement keepers
        uint128 keeperFeeBufferUsd;
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
        uint64 commitmentTime,
        int128 sizeDelta,
        uint256 estimatedOrderFee,
        uint256 estimatedKeeperFee,
        bytes32 trackingCode
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
        uint64 settlementTime,
        int128 sizeDelta,
        uint256 orderFee,
        uint256 keeperFee,
        int128 accruedFunding,
        uint128 accruedUtilization,
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

    /// @notice Creates an order for `accountId` in `marketId` to be settled at a later time.
    /// @param accountId Account to commit an order against
    /// @param marketId Market to commit an order against
    /// @param sizeDelta Size to modify on position after settlement
    /// @param limitPrice The max acceptable price tolerance for settlement
    /// @param keeperFeeBufferUsd tip in USD to pay for settlement keepers
    /// @param hooks An array of settlement hook addresses for execution on settlement
    function commitOrder(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta,
        uint256 limitPrice,
        uint128 keeperFeeBufferUsd,
        address[] memory hooks,
        bytes32 trackingCode
    ) external;

    /// @notice Settles a previously committed order by `accountId` and `marketId`.
    /// @param accountId Account of order to settle
    /// @param marketId Market of order to settle
    /// @param priceUpdateData An acceptable Pyth off-chain price blob
    function settleOrder(
        uint128 accountId,
        uint128 marketId,
        bytes calldata priceUpdateData
    ) external payable;

    /// @notice Cancel a previously committed order by `accountId` and `marketId`. This can only be invoked after
    ///         an order is ready and a keeper can prove price tolerance has been exceeded.
    /// @param accountId Account of the order to cancel
    /// @param marketId Market of the order to cancel
    /// @param priceUpdateData An acceptable Pyth off-chain price blob
    function cancelOrder(
        uint128 accountId,
        uint128 marketId,
        bytes calldata priceUpdateData
    ) external payable;

    /// @notice Cancels a previously committed order that has gone stale by `accountId` and `marketId`.
    ///         This can only happen after an order is stale, and not settled or canceled by a keeper. This
    ///         is a convenience method to clear stale orders without having to provide a Pyth price.
    /// @param accountId Account of stale order to cancel
    /// @param marketId Market of stale order to cancel
    function cancelStaleOrder(uint128 accountId, uint128 marketId) external;

    // --- Views --- //

    /// @notice Returns an order belonging to `accountId` in `marketId`.
    /// @param accountId Account of order to fetch the digest against
    /// @param marketId Market of order to fetch the digest against
    /// @return getOrderDigest A struct of the `OrderDigest`
    function getOrderDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (IOrderModule.OrderDigest memory);

    /// @notice Returns fees charged to open/close an order (along with a dynamic keeper fee).
    /// @param marketId Market to query against
    /// @param sizeDelta Size of impact on skew
    /// @param keeperFeeBufferUsd A tip in USD to pay for settlement keepers
    /// @return orderFee Estimated fees to be paid on settlement
    /// @return keeperFee Estimated fees to be paid to keeper on settlement
    /// @dev Order fees are charged a combination of marker/taker depending on the impact of the `sizeDelta`
    ///      on skew. There is a scenario where if an order flips the skew, the proportion that reduces skew
    ///      is charged with maker fees but the flipped side that expands skew is charged a taker fee.
    /// @dev Keeper fees are fees paid to the keeper to settle an order. The fee is based on gas but can roughly
    ///      be translated to `orderSettlementGasUnits * block.basefee * ETH/USD + bufferUsd`. This fee is bounded
    ///      by a configurable min/max.
    function getOrderFees(
        uint128 marketId,
        int128 sizeDelta,
        uint128 keeperFeeBufferUsd
    ) external view returns (uint256 orderFee, uint256 keeperFee);

    /// @notice Returns an oracle price adjusted by a premium/discount based on how the sizeDelta effects skew.
    /// @param marketId Market to query against
    /// @param size Size of impact on skew
    /// @return getFillPrice Premium/discount adjusted price
    /// @dev The fill can be attributed or when an order is filled. The price is the oracle price + adjustment when
    ///      which an order is settled. Intuitively, the adjustment is a discount if the size reduces the skew (i.e.
    ///      skew is pulled closer to zero). However a premium is applied if skew expands (i.e. skew pushed away
    ///      from zero). More can be read in SIP-279.
    function getFillPrice(uint128 marketId, int128 size) external view returns (uint256);

    /// @notice Returns the oracle price given the `marketId`.
    /// @param marketId Market to query against
    /// @return getOraclePrice Raw oracle price
    function getOraclePrice(uint128 marketId) external view returns (uint256);
}
