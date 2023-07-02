//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IOrderModule {
    // --- Events --- //

    // --- Errors --- //

    // TODO: Consider moving all errors into a `Errors.sol` library to be imported everywhere that needs it.
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

    // --- Views --- //

    function orderFee(int128 sizeDelta) external view returns (uint256 fee);

    /**
     * @dev Returns an oracle price adjusted by a premium/discount based on how the sizeDelta affects skew.
     *
     * 'Fill' can be attributed or when an order is 'filled'. The price is the oracle price + adjustment when
     * which an order is settled. Intuitively, the adjustment is a discount if the size reduces the skew (i.e. skew
     * is pulled closer to zero). However a premium is applied if skew expands (i.e. skew pushed away from zero).
     *
     * More can be read in SIP-279.
     */
    function fillPrice(uint128 marketId, int128 sizeDelta, uint256 oraclePrice) external view returns (uint256 price);
}
