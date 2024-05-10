//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library ErrorUtil {
    /// @notice Thrown when an order is too old (stale) and can no longer be executed.
    error OrderStale();

    /// @notice Thrown when a price is not acceptable.
    error InvalidPrice();

    /// @notice Thrown when an expected order cannot be found.
    error OrderNotFound();

    /// @notice Thrown when an order exists when none is expected.
    error OrderFound();

    /// @notice Thrown when order not ready for settlement.
    error OrderNotReady();

    /// @notice Thrown when owner trying to clear a fresh (not stale) order
    error OrderNotStale();

    /// @notice Thrown when an order cannot settle due to limitPrice tolerance not met.
    error PriceToleranceExceeded(int128 sizeDelta, uint256 price, uint256 limitPrice);

    /// @notice Thrown when an order cannot cancel due to limitPrice is met.
    error PriceToleranceNotExceeded(int128 sizeDelta, uint256 price, uint256 limitPrice);

    /// @notice Thrown when the operating market does not exist.
    error MarketNotFound(uint128 marketId);

    /// @notice Thrown when an expected position cannot be found.
    error PositionNotFound();

    /// @notice Thrown when we expect a position not to exist but it does.
    error PositionFound(uint128 accountId, uint128 marketId);

    /// @notice Thrown when attempting to mutate a position (or reflag) flagged for liquidation.
    error PositionFlagged();

    /// @notice Thrown when attempting to liquidate but position has yet to be flagged.
    error PositionNotFlagged();

    /// @notice Thrown when a position cannot be liquidated.
    error CannotLiquidatePosition();

    /// @notice Thrown when margin cannot be liquidated.
    error CannotLiquidateMargin();

    /// @notice Thrown when liquidation has hit its capacity limit for current window.
    error LiquidationZeroCapacity();

    /// @notice Thrown when attempting to operate with an order with 0 size delta.
    error NilOrder();

    /// @notice Thrown when we expect amount to be non zero.
    error ZeroAmount();

    /// @notice Thrown when a non-zero address is expected.
    error ZeroAddress();

    /// @notice Thrown when a non-zero length (array or otherwise) is expected.
    error ZeroLength();

    /// @notice Thrown when an order pushes past a market's max allowable market size.
    error MaxMarketSizeExceeded();

    /// @notice Thrown when an account has insufficient margin to perform a trade.
    error InsufficientMargin();

    /// @notice Thrown when performing an update will cause a position to be instantly liquidated.
    error CanLiquidatePosition();

    /// @notice Thrown when an account has insufficient collateral to transfer.
    error InsufficientCollateral(address collateralAddress, uint256 available, uint256 value);

    /// @notice Thrown when an account tries to withdrawAll without having any collateral.
    error NilCollateral();

    /// @notice Thrown an debt is found when none was expected to exist.
    error DebtFound(uint128 accountId, uint128 marketId);

    /// @notice Thrown when a user calls payDebt without any debt.
    error NoDebt();

    /// @notice Thrown when exceeding max acceptable collateral.
    error MaxCollateralExceeded(uint256 value, uint256 max);

    /// @notice Thrown when the supplied collateral is unsupported.
    error UnsupportedCollateral(address collateralAddress);

    /// @notice Thrown when the input arrays have mismatched lengths.
    error ArrayLengthMismatch();

    /// @notice Thrown when configuring margin where a previously added collateral was wrongly removed.
    error MissingRequiredCollateral(address collateralAddress);

    /// @notice Thrown when and action is only allowed by account owner.
    error OnlyAccountOwner();

    /// @notice Thrown when an invalid reward distributor was specified.
    error InvalidRewardDistributor(address distributor);

    /// @notice Thrown when a specified hook is not whitelisted, or does not match spec, or otherwise.
    error InvalidHook(address hook);

    /// @notice Thrown when there are too many hooks specified.
    error MaxHooksExceeded();

    /// @notice Thrown when you trying to merge an account with a position that wasn't created in the same block.
    error PositionTooOld();

    /// @notice Thrown when collateral is found when none was expected to exist.
    error CollateralFound();

    /// @notice Thrown when user trying to split an account with too large porportion.
    error AccountSplitProportionTooLarge();

    /// @notice Thrown when user trying to split an account with 0 porportion.
    error ZeroProportion();

    /// @notice Thrown when duplicate account ids were found.
    error DuplicateAccountIds();

    /// @notice Thrown when user trying to merge accounts with positions on opposite sides.
    error InvalidPositionSide();

    /// @notice Thrown when passed incorrect parameter.
    error InvalidParameter(string parameter, string reason);
}
