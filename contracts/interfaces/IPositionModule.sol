//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IPositionModule {
    // --- Mutative --- //

    function flagPosition(uint128 accountId, uint128 marketId) external;

    function liquidatePosition(uint128 accountId, uint128 marketId) external;

    function forceLiquidatePosition(uint128 accountId, uint128 marketId) external;

    // --- Views --- //

    function canLiquidate(uint128 accountId, uint128 marketId) external view returns (bool);

    function isFlagged(uint128 accountId, uint128 marketId) external view returns (bool);
}
