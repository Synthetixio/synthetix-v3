//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import "../interfaces/external/ICustomFeeCalculator.sol";
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
        Fee.setAtomicFixedFeeOverride(synthMarketId, transactor, fixedFeeAmount);
    }

    function setCustomFeeCalculator(
        uint128 synthMarketId,
        address customFeeCalculator
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        if (customFeeCalculator != address(0)) {
            if (
                !ERC165Helper.safeSupportsInterface(
                    customFeeCalculator,
                    type(ICustomFeeCalculator).interfaceId
                )
            ) {
                revert IncorrectCustomFeeCalculatorInterface(customFeeCalculator);
            }
        }

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.customFeeCalculator = customFeeCalculator;

        emit MarketCustomFeeCalculatorSet(synthMarketId, customFeeCalculator);
    }
}
