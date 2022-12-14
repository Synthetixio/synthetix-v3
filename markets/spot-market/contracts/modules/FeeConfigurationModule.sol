//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IFeeConfigurationModule.sol";
import "../storage/SpotMarketFactory.sol";

contract FeeConfigurationModule is IFeeConfigurationModule {
    using SpotMarketFactory for SpotMarketFactory.Data;

    function setFixedFee(uint128 synthMarketId, uint fixedFee) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.fixedFee = fixedFee;

        emit FixedFeeSet(synthMarketId, fixedFee);
    }

    function setMarketSkewFees(
        uint128 synthMarketId,
        uint skewScale,
        uint skewFeePercentage
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.skewScale = skewScale;
        fee.skewFeePercentage = skewFeePercentage;

        emit MarketSkewFeesSet(synthMarketId, skewScale, skewFeePercentage);
    }

    function setMarketUtilizationFees(
        uint128 synthMarketId,
        uint[] calldata utilizationThresholds,
        uint utilizationFeeRate
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.utilizationThresholds = utilizationThresholds;
        fee.utilizationFeeRate = utilizationFeeRate;

        emit MarketUtilizationFeesSet(synthMarketId, utilizationThresholds);
    }
}
