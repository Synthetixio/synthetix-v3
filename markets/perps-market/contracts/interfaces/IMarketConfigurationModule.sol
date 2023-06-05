//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {OrderFee} from "../storage/OrderFee.sol";

/**
 * @title Module for updating configuration in relation to async order modules.
 */
interface IMarketConfigurationModule {
    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external returns (uint256 strategyId);

    function setSkewScale(uint128 marketId, uint256 skewScale) external;

    function setOrderFees(
        uint128 marketId,
        PerpsMarketConfiguration.OrderType key,
        OrderFee.Data memory value
    ) external;

    function setMaxMarketValue(uint128 marketId, uint256 maxMarketValue) external;

    function setMaxFundingVelocity(uint128 marketId, uint256 maxFundingVelocity) external;

    function setInitialMarginFraction(uint128 marketId, uint256 initialMarginFraction) external;

    function setMaintenanceMarginFraction(
        uint128 marketId,
        uint256 maintenanceMarginFraction
    ) external;

    function setLockedOiPercent(uint128 marketId, uint256 lockedOiPercent) external;

    function setMaxLiquidationLimitAccumulationMultiplier(
        uint128 marketId,
        uint256 maxLiquidationLimitAccumulationMultiplier
    ) external;

    function setLiquidationRewardRatioD18(
        uint128 marketId,
        uint256 liquidationRewardRatioD18
    ) external;

    function getOrderFees(
        uint128 marketId,
        PerpsMarketConfiguration.OrderType key
    ) external view returns (OrderFee.Data memory);

    function getSettlementStrategies(
        uint128 marketId
    ) external view returns (SettlementStrategy.Data[] memory);

    function getMaxMarketValue(uint128 marketId) external view returns (uint256);

    function getMaxFundingVelocity(uint128 marketId) external view returns (uint256);

    function getSkewScale(uint128 marketId) external view returns (uint256);

    function getInitialMarginFraction(uint128 marketId) external view returns (uint256);

    function getMaintenanceMarginFraction(uint128 marketId) external view returns (uint256);

    function getLockedOiPercent(uint128 marketId) external view returns (uint256);

    function getMaxLiquidationLimitAccumulationMultiplier(
        uint128 marketId
    ) external view returns (uint256);

    function getLiquidationRewardRatioD18(uint128 marketId) external view returns (uint256);
}
