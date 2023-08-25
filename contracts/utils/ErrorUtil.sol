//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

library ErrorUtil {
    // @dev Thrown when an order is too old (stale) and can no longer be executed.
    error StaleOrder();

    // @dev Thrown when using an off-chain oracle price is too old.
    error StalePrice();

    // @dev Thrown when a price is not acceptable.
    error InvalidPrice();

    // @dev Thrown when an expected order cannot be found.
    error OrderNotFound();

    // @dev Thrown when an order exists when none is expected.
    error OrderFound(uint128 accountId);

    // @dev Thrown when order not ready for settlement.
    error OrderNotReady();

    // @dev Thrown when an order cannot settle due to limitPrice tolerance not met.
    error PriceToleranceExceeded(int128 sizeDelta, uint256 price, uint256 limitPrice);

    // @dev Thrown when the operating market does not exist.
    error MarketNotFound(uint128 marketId);

    // @dev Thrown when an expected position cannot be found.
    error PositionNotFound();

    // @dev Thrown when we expect a position not to exist but it does.
    error PositionFound(uint128 accountId, uint128 marketId);

    // @dev Thrown when attempting to mutate a position (or reflag) flagged for liquidation.
    error PositionFlagged();

    // @dev Thrown when attempting to liquidate but position has yet to be flagged.
    error PositionNotFlagged();

    // @dev Thrown when a position cannot be liquidated.
    error CannotLiquidatePosition();

    // @dev Thrown when liquidation has hit its capacity limit for current window.
    error LiquidationZeroCapacity();

    // @dev Thrown when attempting to operate with an order with 0 size delta.
    error NilOrder();

    // @dev Thrown when we expect amount to be non zero
    error ZeroAmount();

    // @dev Thrown when an order pushes past a market's max allowable open interest (OI).
    error MaxMarketSizeExceeded();

    // @dev Thrown when an account has insufficient margin to perform a trade.
    error InsufficientMargin();

    // @dev Thrown when performing an update will cause a position to be instantly liquidated.
    error CanLiquidatePosition();

    // @dev Emitted when a collateral type in configuration is zero.
    error ZeroAddress();

    // @dev Thrown when an account has insufficient collateral to transfer.
    error InsufficientCollateral(address collateral, uint256 available, uint256 value);

    // @dev Thrown when an account tries to withdrawAll without having any collateral
    error NilCollateral();

    // @dev Thrown when attempting to deposit a collateral that has reached a max deportable amount.
    error MaxCollateralExceeded(uint256 value, uint256 max);

    // @dev Thrown when the supplied collateralType address is unsupported.
    error UnsupportedCollateral(address collateral);

    // @dev Thrown when the input arrays have mismatched lengths.
    error ArrayLengthMismatch();
}
