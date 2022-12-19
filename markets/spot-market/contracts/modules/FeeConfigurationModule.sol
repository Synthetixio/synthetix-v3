//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IFeeConfigurationModule.sol";
import "../storage/SpotMarketFactory.sol";

contract FeeConfigurationModule is IFeeConfigurationModule {
    using SpotMarketFactory for SpotMarketFactory.Data;

    function setAtomicFixedFee(uint128 synthMarketId, uint atomicFixedFee) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.atomicFixedFee = atomicFixedFee;

        emit AtomicFixedFeeSet(synthMarketId, atomicFixedFee);
    }

    function setMarketSkewScale(uint128 marketId, uint skewScale) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);

        Price.Data storage price = Price.load(marketId);
        price.skewScale = skewScale;

        emit MarketSkewScaleSet(marketId, skewScale);
    }

    function setMarketUtilizationFees(
        uint128 synthMarketId,
        uint utilizationFeeRate
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.utilizationFeeRate = utilizationFeeRate;

        emit MarketUtilizationFeesSet(synthMarketId, utilizationFeeRate);
    }

    function setCustomTransactorFees(
        uint128 synthMarketId,
        address transactor,
        uint fixedFeeAmount
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);
        Fee.setFeeForTransactor(synthMarketId, transactor, fixedFeeAmount);
    }
}
