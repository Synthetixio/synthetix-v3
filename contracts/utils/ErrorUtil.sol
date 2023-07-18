//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library ErrorUtil {
    // --- Shared Errors --- //

    // @dev Thrown when an order exists when none is expected.
    error OrderFound(uint128 accountId);

    // @dev Thrown when performing an update will cause a position to be instantly liquidated.
    error CanLiquidatePosition(uint128 accountId);
}
