//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface ILiquidationModule {
    error NotEligibleForLiquidation(uint128 accountId);

    event PositionLiquidated(
        uint128 indexed accountId,
        uint128 indexed marketId,
        uint256 amountLiquidated,
        int128 currentPositionSize
    );

    event AccountLiquidated(uint128 indexed accountId, uint256 reward, bool partiallyLiquidated);

    function liquidate(uint128 accountId) external;

    function liquidateFlagged() external;
}
