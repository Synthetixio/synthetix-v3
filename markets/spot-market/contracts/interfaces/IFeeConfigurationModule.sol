//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Spot Market Interface
interface IFeeConfigurationModule {
    event MarketUtilizationFeesSet(uint indexed synthMarketId, uint utilizationFeeRate);
    event MarketSkewFeesSet(uint indexed synthMarketId, uint skewScale);
    event FixedFeeSet(uint indexed synthMarketId, uint fixedFee);
    event InterestRateSet(uint indexed synthMarketId, uint interestRate);
    event MarketSkewScaleSet(uint indexed marketId, uint skewScale);
    event AtomicFixedFeeSet(uint indexed synthMarketId, uint atomicFixedFee);

    function setAtomicFixedFee(uint128 synthMarketId, uint atomicFixedFee) external;

    function setMarketSkewScale(uint128 synthMarketId, uint skewScale) external;

    function setMarketUtilizationFees(uint128 synthMarketId, uint utilizationFeeRate) external;

    function setCustomTransactorFees(
        uint128 synthMarketId,
        address transactor,
        uint fixedFeeAmount
    ) external;
}
