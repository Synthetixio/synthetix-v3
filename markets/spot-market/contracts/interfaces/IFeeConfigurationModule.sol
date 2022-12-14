//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Spot Market Interface
interface IFeeConfigurationModule {
    event MarketUtilizationFeesSet(uint indexed synthMarketId, uint[] utilizationThresholds);
    event MarketSkewFeesSet(uint indexed synthMarketId, uint skewScale, uint skewFeePercentage);
    event FixedFeeSet(uint indexed synthMarketId, uint fixedFee);

    function setFixedFee(uint128 synthMarketId, uint fixedFee) external;

    function setMarketSkewFees(
        uint128 synthMarketId,
        uint skewScale,
        uint skewFeePercentage
    ) external;

    function setMarketUtilizationFees(
        uint128 synthMarketId,
        uint[] calldata utilizationThresholds,
        uint utilizationFeeRate
    ) external;
}
