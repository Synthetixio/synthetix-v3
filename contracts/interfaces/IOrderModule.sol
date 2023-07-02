//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IOrderModule {
    // --- Events --- //

    // --- Errors --- //

    error InvalidPrice();
    error PriceOutOfBounds();
    error CanLiquidate();
    error CannotLiquidate();
    error MaxOiExceeded();
    error MaxLeverageExceeded();
    error OrderNotFound();
    error PendingOrderFound();
    error PriceToleranceExceeded();

    // --- Mutative --- //

    /**
     * @dev Creates an order to be submitted for settlement.
     */
    function commitOrder(uint128 accountId, uint128 marketId, int128 sizeDelta, uint256 desiredFillPrice) external;

    /**
     * @dev Given an accountId, find the associated market by `marketId` and settles the order.
     */
    function settledOrder(uint128 accountId, uint128 marketId) external;

    function cancelOrder(uint128 accountId, uint128 marketId) external;

    // function orderFee(int sizeDelta) external view returns (uint fee);
}
