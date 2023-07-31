//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpCollateral} from "../storage/PerpCollateral.sol";
import {Position} from "../storage/Position.sol";
import "../interfaces/ILiquidationModule.sol";

contract LiquidationModule is ILiquidationModule {
    using PerpMarket for PerpMarket.Data;

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

    /**
     * @inheritdoc ILiquidationModule
     */
    function getLiquidationMargins(uint128 accountId, uint128 marketId) external view returns (uint256 im, uint256 mm) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        (im, mm) = Position.getLiquidationMargins(
            marketId,
            market.positions[accountId].size,
            marketConfig.skewScale,
            market.getOraclePrice()
        );
    }
}
