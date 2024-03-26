//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IBasePerpMarket} from "./IBasePerpMarket.sol";

interface ILiquidationModule is IBasePerpMarket {
    // --- Events --- //

    /// @notice Emitted when a position is flagged for liquidation.
    /// @param accountId Account of position flagged for liqudation
    /// @param marketId Market of the position flagged
    /// @param flagger Address of keeper that executed flag
    /// @param flagKeeperReward USD fee paid to keeper for invoking flag
    /// @param flaggedPrice Market oracle price at the time of flag
    event PositionFlaggedLiquidation(
        uint128 indexed accountId,
        uint128 indexed marketId,
        address flagger,
        uint256 flagKeeperReward,
        uint256 flaggedPrice
    );

    /// @notice Emitted when a position has been liquidated.
    /// @param accountId Account of the liquidated position
    /// @param marketId Market of the liquidated position
    /// @param sizeBeforeLiquidation Position size before liquidation occurred
    /// @param remainingSize Position size after liquidation
    /// @param keeper Address of keeper that executed liquidation
    /// @param liqKeeperFee USD fee paid to the keeper for invoking liquidation
    /// @param liquidationPrice Market oracle price at the time of liquidation
    event PositionLiquidated(
        uint128 indexed accountId,
        uint128 indexed marketId,
        int128 sizeBeforeLiquidation,
        int128 remainingSize,
        address keeper,
        address flagger,
        uint256 liqKeeperFee,
        uint256 liquidationPrice
    );

    /// @notice Emitted when margin is liquidated due to debt.
    /// @param accountId Account that had their margin liquidated
    /// @param marketId Market of liquidated account margin (isolated)
    /// @param keeperReward USD fee paid to keeper for liquidating account margin
    event MarginLiquidated(
        uint128 indexed accountId,
        uint128 indexed marketId,
        uint256 keeperReward
    );

    // --- Mutations --- //

    /// @notice Flags position belonging to `accountId` for liquidation. A flagged position is frozen from all operations.
    /// @param accountId Account id of position to be flagged for liquidation
    /// @param marketId Market id of position to be flagged for liquidation
    function flagPosition(uint128 accountId, uint128 marketId) external;

    /// @notice Liquidates a flagged position. A position must be flagged first before it can be liquidated.
    /// @param accountId Account id of previously flagged position for liquidation
    /// @param marketId Market id of previously flagged position for liquidation
    function liquidatePosition(uint128 accountId, uint128 marketId) external;

    /// @notice Liquidates an account's margin (only) due to debt by.
    /// @param accountId Account id the margin account to liquidate
    /// @param marketId Market id of the margin account to liquidate
    function liquidateMarginOnly(uint128 accountId, uint128 marketId) external;

    // --- Views --- //

    /// @notice Returns fees paid to flagger and liquidator (in USD) if position successfully liquidated.
    /// @param accountId Account of the position to query against
    /// @param marketId Market of the position to query against
    /// @return liqReward USD fee paid as reward to keeper for flagging position for liquidation
    /// @return keeperFee USD fee paid as reward to keeper for executing liquidation on flagged position
    function getLiquidationFees(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256 liqReward, uint256 keeperFee);

    /// @notice Returns the remaining liquidation capacity for a given `marketId` in the current liquidation window.
    /// @param marketId The market the to query against
    /// @return maxLiquidatableCapacity Maximum size that can be liquidated in a single chunk
    /// @return remainingCapacity Remaining size in the current liquidation window before cap is met
    /// @return lastLiquidationTime block.timestamp of when the last time a liquidation occurred
    function getRemainingLiquidatableSizeCapacity(
        uint128 marketId
    )
        external
        view
        returns (
            uint128 maxLiquidatableCapacity,
            uint128 remainingCapacity,
            uint128 lastLiquidationTime
        );

    /// @notice Returns whether a position owned by `accountId` can be flagged for liquidated.
    /// @param accountId Account of the position to query against
    /// @param marketId Market of the position to query against
    /// @return isPositionLiquidatable True if position can be flagged for liquidation, false otherwise
    function isPositionLiquidatable(
        uint128 accountId,
        uint128 marketId
    ) external view returns (bool);

    /// @notice Returns whether an accounts margin can be liquidated.
    /// @param accountId Account of margin to query against
    /// @param marketId Market of margin to query against
    /// @return isMarginLiquidatable True if margin can be liquidated, false otherwise
    function isMarginLiquidatable(uint128 accountId, uint128 marketId) external view returns (bool);

    /// @notice Returns the IM (initial margin) and MM (maintenance margin) for a given account, market, and sizeDelta.
    ///         Specify a sizeDelta of 0 for the current IM/MM of an existing position.
    /// @param accountId Account of position to query against
    /// @param marketId Market of position to query against
    /// @return im Required initial margin in USD
    /// @return mm Required maintenance margin in USD
    function getLiquidationMarginUsd(
        uint128 accountId,
        uint128 marketId,
        int128 sizeDelta
    ) external view returns (uint256 im, uint256 mm);

    /// @notice Returns the health factor for a given `accountId` by `marketId`. <= 1 means the position can be liquidated.
    /// @param accountId Account of position to query against
    /// @param marketId Market of position to query against
    /// @return getHealthFactor A number, which when lte 1 results in liquidation and above 1 is healthy
    function getHealthFactor(uint128 accountId, uint128 marketId) external view returns (uint256);
}
