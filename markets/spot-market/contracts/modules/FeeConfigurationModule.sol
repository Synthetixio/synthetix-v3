//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";

import "../interfaces/IFeeConfigurationModule.sol";
import "../interfaces/ISynthTokenModule.sol";
import "../interfaces/external/IFeeCollector.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/FeeConfiguration.sol";

/**
 * @title Module for configuring fees for registered synth markets.
 * @dev See IFeeConfigurationModule.
 */
contract FeeConfigurationModule is IFeeConfigurationModule {
    using SpotMarketFactory for SpotMarketFactory.Data;
    using AssociatedSystem for AssociatedSystem.Data;

    /**
     * @inheritdoc IFeeConfigurationModule
     */
    function setAtomicFixedFee(uint128 synthMarketId, uint atomicFixedFee) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        FeeConfiguration.Data storage feeConfiguration = FeeConfiguration.load(synthMarketId);
        feeConfiguration.atomicFixedFee = atomicFixedFee;

        emit AtomicFixedFeeSet(synthMarketId, atomicFixedFee);
    }

    /**
     * @inheritdoc IFeeConfigurationModule
     */
    function setMarketSkewScale(uint128 synthMarketId, uint skewScale) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        FeeConfiguration.Data storage feeConfiguration = FeeConfiguration.load(synthMarketId);
        feeConfiguration.skewScale = skewScale;

        emit MarketSkewScaleSet(synthMarketId, skewScale);
    }

    /**
     * @inheritdoc IFeeConfigurationModule
     */
    function setMarketUtilizationFees(
        uint128 synthMarketId,
        uint utilizationFeeRate
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        FeeConfiguration.Data storage feeConfiguration = FeeConfiguration.load(synthMarketId);
        feeConfiguration.utilizationFeeRate = utilizationFeeRate;

        emit MarketUtilizationFeesSet(synthMarketId, utilizationFeeRate);
    }

    /**
     * @inheritdoc IFeeConfigurationModule
     */
    function setCustomTransactorFees(
        uint128 synthMarketId,
        address transactor,
        uint fixedFeeAmount
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);
        FeeConfiguration.setAtomicFixedFeeOverride(synthMarketId, transactor, fixedFeeAmount);

        emit AtomicTransactorFixedFeeSet(synthMarketId, transactor, fixedFeeAmount);
    }

    /**
     * @inheritdoc IFeeConfigurationModule
     */
    function setFeeCollector(uint128 synthMarketId, address feeCollector) external override {
        if (feeCollector != address(0)) {
            if (
                !ERC165Helper.safeSupportsInterface(feeCollector, type(IFeeCollector).interfaceId)
            ) {
                revert InvalidFeeCollectorInterface(feeCollector);
            }
        }

        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        FeeConfiguration.Data storage feeConfiguration = FeeConfiguration.load(synthMarketId);
        feeConfiguration.feeCollector = IFeeCollector(feeCollector);

        emit FeeCollectorSet(synthMarketId, feeCollector);
    }

    function setWrapperFees(uint128 synthMarketId, int wrapFee, int unwrapFee) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        FeeConfiguration.Data storage feeConfiguration = FeeConfiguration.load(synthMarketId);
        feeConfiguration.wrapFixedFee = wrapFee;
        feeConfiguration.unwrapFixedFee = unwrapFee;

        emit WrapperFeesSet(synthMarketId, wrapFee, unwrapFee);
    }
}
