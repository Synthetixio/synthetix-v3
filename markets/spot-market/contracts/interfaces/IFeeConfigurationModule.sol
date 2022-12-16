//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Spot Market Interface
interface IFeeConfigurationModule {
    event MarketUtilizationFeesSet(uint indexed synthMarketId, uint utilizationFeeRate);
    event MarketSkewFeesSet(uint indexed synthMarketId, uint skewScale);
    event FixedFeeSet(uint indexed synthMarketId, uint fixedFee);

    function setFixedFee(uint128 synthMarketId, uint fixedFee) external;

    function setMarketSkewFees(uint128 synthMarketId, uint skewScale) external;

    function setMarketUtilizationFees(uint128 synthMarketId, uint utilizationFeeRate) external;

    function setCustomTransactorFees() external;
}
