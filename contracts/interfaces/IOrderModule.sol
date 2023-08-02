//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./IBasePerpMarket.sol";

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
     * @dev Returns fee charged to open/close an order.
     *
     * This incorporates the scenario where a if a trade flips the skew, the proportion that reduces the skew
     * is charged a makerFee but the flipped side that expands skew is charged a takerFee.
     */
    function getOrderFee(uint128 marketId, int128 sizeDelta) external view returns (uint256 fee);

    /**
     * @dev Returns fee rewarded to keeper required to perform a permissionless operation.
     *
     * Calculation is as follows `orderSettlementGasUnits * block.basefee * ETH/USD + bufferUsd. Which, can roughly
     * be related to (units * baseFee) / 10e9 * oraclePrice.
     *
     * The fee is then bounded between a configurable min/max and a buffer is then provided.
     */
    function getOrderKeeperFee(uint128 marketId, uint256 keeperFeeBufferUsd) external view returns (uint256 fee);

    /**
     * @dev Returns an oracle price adjusted by a premium/discount based on how the sizeDelta effects skew.
     *
     * 'Fill' can be attributed or when an order is 'filled'. The price is the oracle price + adjustment when
     * which an order is settled. Intuitively, the adjustment is a discount if the size reduces the skew (i.e. skew
     * is pulled closer to zero). However a premium is applied if skew expands (i.e. skew pushed away from zero).
     *
     * price      = $1200 USD (oracle)
     * size       = 100
     * skew       = 0
     * skew_scale = 1,000,000 (1M)
     *
     * pd_before = 0 / 1,000,000
     *           = 0
     * pd_after  = (0 + 100) / 1,000,000
     *           = 100 / 1,000,000
     *           = 0.0001
     * price_before = 1200 * (1 + pd_before)
     *              = 1200 * (1 + 0)
     *              = 1200
     * price_after  = 1200 * (1 + pd_after)
     *              = 1200 * (1 + 0.0001)
     *              = 1200 * (1.0001)
     *              = 1200.12
     * fill_price = (price_before + price_after) / 2
     *            = (1200 + 1200.12) / 2
     *            = 1200.06
     *
     * More can be read in SIP-279.
     */
    function getFillPrice(
        uint128 marketId,
        int128 sizeDelta,
        uint256 oraclePrice
    ) external view returns (uint256 price);

    /**
     * @dev Returns the oracle price given the `marketId`.
     */
    function getOraclePrice(uint128 marketId) external view returns (uint256 price);
}
