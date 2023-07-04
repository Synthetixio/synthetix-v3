//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @dev A library that encapsulates error related definitions and functions.
 */
library Error {
    // @dev Thrown when attempting to operate with an order with 0 size delta.
    error NilOrder();

    // @dev Thrown when using an off-chain oracle price is too old.
    error StalePrice();

    // @dev Thrown when an order pushes past a market's max allowable open interest (OI).
    error MaxOiExceeded();

    // @dev Thrown when an order pushes a position (new or current) past max market leverage.
    error MaxLeverageExceeded();

    // @dev Thrown when an account has insufficient collateral to transfer.
    error InsufficientCollateral(int256 collateral, int256 value);

    // @dev Thrown when an account has insufficient margin to perform a trade.
    error InsufficientMargin();

    // @dev Thrown when attempting to deposit a collateral that has reached max deportable amount.
    error MaxCollateralExceeded(int256 value, uint256 max);

    // @dev Thrown when an expected cannot be found.
    error OrderNotFound();

    // @dev Thrown when an order already exists when it is expected not to have been.
    error OrderAlreadyExists(uint128 accountId);

    // @dev Thrown when an order cannot settle due to limitPrice tolerance not met.
    error PriceToleranceExceeded(uint128 accountId);

    // @dev Thrown when an expected position cannot be found.
    error PositionNotFound();

    // @dev Thrown when attempting to mutate a position flagged for liquidation.
    error PositionFlagged();

    // @dev Thrown when attempting to liquidate but position has yet to be flagged.
    error PositionNotFlagged();

    // @dev Thrown when performing an update will cause a position to be instantly liquidated.
    error PositionCanLiquidate(uint128 accountId);

    // @dev Thrown when a position cannot be liquidated.
    error PositionCannotLiquidate();
}
