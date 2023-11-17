//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

library ErrorUtil {
    // @notice Thrown when an order is too old (stale) and can no longer be executed.
    error StaleOrder();

    // @notice Thrown when using an off-chain oracle price is too old.
    error StalePrice();

    // @notice Thrown when a price is not acceptable.
    error InvalidPrice();

    // @notice Thrown when an expected order cannot be found.
    error OrderNotFound();

    // @notice Thrown when an order exists when none is expected.
    error OrderFound();

    // @notice Thrown when order not ready for settlement.
    error OrderNotReady();

    // @notice Thrown when an order cannot settle due to limitPrice tolerance not met.
    error PriceToleranceExceeded(int128 sizeDelta, uint256 price, uint256 limitPrice);

    // @notice Thrown during settlement when off-chain diverges too far from on-chain price.
    error PriceDivergenceExceeded(uint256 offchainPrice, uint256 onchainPrice);

    // @notice Thrown when the operating market does not exist.
    error MarketNotFound(uint128 marketId);

    // @notice Thrown when an expected position cannot be found.
    error PositionNotFound();

    // @notice Thrown when we expect a position not to exist but it does.
    error PositionFound(uint128 accountId, uint128 marketId);

    // @notice Thrown when attempting to mutate a position (or reflag) flagged for liquidation.
    error PositionFlagged();

    // @notice Thrown when attempting to liquidate but position has yet to be flagged.
    error PositionNotFlagged();

    // @notice Thrown when a position cannot be liquidated.
    error CannotLiquidatePosition();

    // @notice Thrown when liquidation has hit its capacity limit for current window.
    error LiquidationZeroCapacity();

    // @notice Thrown when attempting to operate with an order with 0 size delta.
    error NilOrder();

    // @notice Thrown when we expect amount to be non zero.
    error ZeroAmount();

    // @notice Thrown when a non-zero address is expected.
    error ZeroAddress();

    // @notice Thrown when an order pushes past a market's max allowable market size.
    error MaxMarketSizeExceeded();

    // @notice Thrown when an account has insufficient margin to perform a trade.
    error InsufficientMargin();

    // @notice Thrown when performing an update will cause a position to be instantly liquidated.
    error CanLiquidatePosition();

    // @notice Thrown when an account has insufficient collateral to transfer.
    error InsufficientCollateral(uint128 synthMarketId, uint256 available, uint256 value);

    // @notice Thrown when an account tries to withdrawAll without having any collateral
    error NilCollateral();

    // @notice Thrown when attempting to deposit a collateral that has reached a max deportable amount.
    error MaxCollateralExceeded(uint256 value, uint256 max);

    // @notice Thrown when the supplied collateral is unsupported.
    error UnsupportedCollateral(uint128 synthMarketId);

    // @notice Thrown when the input arrays have mismatched lengths.
    error ArrayLengthMismatch();

    // @notice Thrown when msg.sender is not authorized.
    error Unauthorized(address sender);
}
