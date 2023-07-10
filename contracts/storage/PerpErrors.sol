//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @dev A library that encapsulates error related definitions and functions.
 */
library PerpErrors {
    // @dev Thrown when attempting to operate with an order with 0 size delta.
    error NilOrder();

    // @dev Thrown when an order is too old (stale) and can no longer be executed.
    error StaleOrder();

    // @dev Thrown when using an off-chain oracle price is too old.
    error StalePrice();

    // @dev Thrown when a price is not acceptable.
    error InvalidPrice();

    // @dev Thrown when Pyth price and on-chain price deviates too far.
    error PriceDiverenceTooHigh(uint256 p1, uint256 p2);

    // @dev Thrown when an order pushes past a market's max allowable open interest (OI).
    error MaxMarketSizeExceeded();

    // @dev Thrown when an order pushes a position (new or current) past max market leverage.
    error MaxLeverageExceeded();

    // @dev Thrown when the operating market does not exist.
    error MarketNotFound(uint128 marketId);

    // @dev Thrown when an account has insufficient collateral to transfer.
    error InsufficientCollateral(int256 collateral, int256 value);

    // @dev Thrown when an account has insufficient margin to perform a trade.
    error InsufficientMargin();

    // @dev Thrown when attempting to deposit a collateral that has reached max deportable amount.
    error MaxCollateralExceeded(int256 value, uint256 max);

    // @dev Thrown when an expected cannot be found.
    error OrderNotFound(uint128 accountId);

    // @dev Thrown when order not ready for settlement.
    error OrderNotReady();

    // @dev Thrown when an order exists when none is expected.
    error OrderFound(uint128 accountId);

    // @dev Thrown when an order cannot settle due to limitPrice tolerance not met.
    error PriceToleranceExceeded(uint128 accountId);

    // @dev Thrown when an expected position cannot be found.
    error PositionNotFound();

    // @dev Thrown when attempting to mutate a position flagged for liquidation.
    error PositionFlagged();

    // @dev Thrown when attempting to liquidate but position has yet to be flagged.
    error PositionNotFlagged();

    // @dev Thrown when performing an update will cause a position to be instantly liquidated.
    error CanLiquidatePosition(uint128 accountId);

    // @dev Thrown when a position cannot be liquidated.
    error CannotLiquidatePosition();
}
