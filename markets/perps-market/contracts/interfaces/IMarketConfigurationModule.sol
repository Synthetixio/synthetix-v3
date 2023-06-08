//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {OrderFee} from "../storage/OrderFee.sol";

/**
 * @title Module for updating configuration in relation to async order modules.
 */
interface IMarketConfigurationModule {
    event SettlementStrategyAdded(uint128 marketId, SettlementStrategy.Data strategy);
    event OrderFeesSet(uint128 marketId, uint256 makerFeeRatio, uint256 takerFeeRatio);
    event FundingParametersSet(uint128 marketId, uint256 skewScale, uint256 maxFundingVelocity);
    event LiquidationParametersSet(
        uint128 marketId,
        uint256 initialMarginFraction,
        uint256 maintenanceMarginFraction,
        uint256 liquidationRewardRatioD18,
        uint256 maxLiquidationLimitAccumulationMultiplier
    );
    event MaxMarketValueSet(uint128 marketId, uint256 maxMarketValue);
    event LockedOiPercentSet(uint128 marketId, uint256 lockedOiPercent);
    event SettlementStrategyEnabled(uint128 marketId, uint256 strategyId, bool enabled);

    function addSettlementStrategy(
        uint128 marketId,
        SettlementStrategy.Data memory strategy
    ) external returns (uint256 strategyId);

    function setOrderFees(uint128 marketId, uint256 makerFeeRatio, uint256 takerFeeRatio) external;

    function setFundingParameters(
        uint128 marketId,
        uint256 skewScale,
        uint256 maxFundingVelocity
    ) external;

    function setLiquidationParameters(
        uint128 marketId,
        uint256 initialMarginFraction,
        uint256 maintenanceMarginFraction,
        uint256 liquidationRewardRatioD18,
        uint256 maxLiquidationLimitAccumulationMultiplier
    ) external;

    function setMaxMarketValue(uint128 marketId, uint256 maxMarketValue) external;

    function setLockedOiPercent(uint128 marketId, uint256 lockedOiPercent) external;

    function setSettlementStrategyEnabled(
        uint128 marketId,
        uint256 strategyId,
        bool enabled
    ) external;

    function getSettlementStrategy(
        uint128 marketId,
        uint256 strategyId
    ) external view returns (SettlementStrategy.Data memory settlementStrategy);

    function getLiquidationParameters(
        uint128 marketId
    )
        external
        view
        returns (
            uint256 initialMarginFraction,
            uint256 maintenanceMarginFraction,
            uint256 liquidationRewardRatioD18,
            uint256 maxLiquidationLimitAccumulationMultiplier
        );

    function getFundingParameters(
        uint128 marketId
    ) external view returns (uint256 skewScale, uint256 maxFundingVelocity);

    function getMaxMarketValue(uint128 marketId) external view returns (uint256 maxMarketValue);

    function getOrderFees(
        uint128 marketId
    ) external view returns (uint256 makerFee, uint256 takerFee);

    function getLockedOiPercent(uint128 marketId) external view returns (uint256 lockedOiPercent);
}
