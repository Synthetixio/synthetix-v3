//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface ILiquidationModule {
    // --- Errors --- //

    // @dev Thrown when an expected position cannot be found.
    error PositionNotFound();

    // @dev Thrown when attempting to mutate a position flagged for liquidation.
    error PositionFlagged();

    // @dev Thrown when attempting to liquidate but position has yet to be flagged.
    error PositionNotFlagged();

    // @dev Thrown when a position cannot be liquidated.
    error CannotLiquidatePosition();

    // --- Mutative --- //

    /**
     * @dev Flags position belonging to `accountId` for liquidation. A flagged position is frozen from all operations.
     */
    function flagPosition(uint128 accountId, uint128 marketId) external;

    /**
     * @dev Liquidates a flagged position.
     */
    function liquidatePosition(uint128 accountId, uint128 marketId) external;

    // --- Views --- //

    /**
     * @dev Returns whether a position owned by `accountId` can be flagged for liquidated.
     */
    function canLiquidatePosition(uint128 accountId, uint128 marketId) external view returns (bool);

    /**
     * @dev Returns the IM (initial maintenance) and MM (maintenance margin) for a given account and market.
     */
    function getLiquidationMargins(uint128 accountId, uint128 marketId) external view returns (uint256 im, uint256 mm);
}
