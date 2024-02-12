//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IBasePerpMarket} from "./IBasePerpMarket.sol";

interface ILiquidationModule is IBasePerpMarket {
    // --- Events --- //

    // @notice Emitted when a position has been liquidated.
    event PositionLiquidated(
        uint128 indexed accountId,
        uint128 marketId,
        int128 remainingSize,
        address keeper,
        address flagger,
        uint256 liqKeeperFee,
        uint256 liquidationPrice
    );

    // @notice Emitted when a position is flagged for liquidation.
    event PositionFlaggedLiquidation(
        uint128 indexed accountId,
        uint128 marketId,
        address flagger,
        uint256 flagKeeperReward,
        uint256 flaggedPrice
    );
    // @notice Emitted when margin is liquidated due to debt.
    event MarginLiquidated(uint128 indexed accountId, uint128 marketId);

    // --- Mutations --- //

    /**
     * @notice Flags position belonging to `accountId` for liquidation. A flagged position is frozen from all operations.
     */
    function flagPosition(uint128 accountId, uint128 marketId) external;

    /**
     * @notice Liquidates a flagged position. A position must be flagged first before it can be liquidated.
     */
    function liquidatePosition(uint128 accountId, uint128 marketId) external;

    /**
     * @notice Liquidates a margin due to debt.
     */
    function liquidateMarginOnly(uint128 accountId, uint128 marketId) external;

    // --- Views --- //

    /**
     * @notice Returns fees paid to flagger and liquidator (in USD) if position successfully liquidated.
     */
    function getLiquidationFees(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256 liqReward, uint256 keeperFee);

    /**
     * @notice Returns the remaining liquidation capacity for a given `marketId` in the current liquidation window.
     */
    function getRemainingLiquidatableSizeCapacity(
        uint128 marketId
    ) external view returns (uint128 maxLiquidatableCapacity, uint128 remainingCapacity, uint128 lastLiquidationTime);

    /**
     * @notice Returns whether a position owned by `accountId` can be flagged for liquidated.
     */
    function isPositionLiquidatable(uint128 accountId, uint128 marketId) external view returns (bool);

    /**
     * @notice Returns whether an accounts margin can be liquidated.
     */
    function isMarginLiquidatable(uint128 accountId, uint128 marketId) external view returns (bool);

    /**
     * @notice Returns the IM (initial maintenance) and MM (maintenance margin) for a given account and market.
     */
    function getLiquidationMarginUsd(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256 im, uint256 mm);

    /**
     * @notice Returns the health factor for a given `accountId` by `marketId`. <= 1 means the position can be liquidated.
     */
    function getHealthFactor(uint128 accountId, uint128 marketId) external view returns (uint256);
}
