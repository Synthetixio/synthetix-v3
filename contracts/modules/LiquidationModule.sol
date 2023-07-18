//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/ILiquidationModule.sol";

contract LiquidationModule is ILiquidationModule {
    // --- Mutative --- //

    /**
     * @inheritdoc ILiquidationModule
     */
    function flagPosition(uint128 accountId, uint128 marketId) external {}

    /**
     * @inheritdoc ILiquidationModule
     */
    function liquidatePosition(uint128 accountId, uint128 marketId) external {}

    // --- Views --- //

    /**
     * @inheritdoc ILiquidationModule
     */
    function canLiquidatePosition(uint128 accountId, uint128 marketId) external view returns (bool) {}
}
