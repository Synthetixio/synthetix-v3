//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IPositionModule {
    // --- Errors --- //

    error PositionNotFound();
    error PositionFlagged();
    error PositionNotFlagged();

    // --- Mutative --- //

    function flagPosition(address account) external;

    function liquidatePosition(address account) external;

    function forceLiquidatePosition(address account) external;

    // --- Views --- //

    function canLiquidate(address account) external view returns (bool);

    function isFlagged(address account) external view returns (bool);
}
