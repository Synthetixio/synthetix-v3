//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC165Helper} from "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import {IMarketConfigurationModule} from "../interfaces/IMarketConfigurationModule.sol";
import {IFeeCollector} from "../interfaces/external/IFeeCollector.sol";
import {SpotMarketFactory} from "../storage/SpotMarketFactory.sol";
import {MarketConfiguration} from "../storage/MarketConfiguration.sol";

/**
 * @title Module for configuring fees for registered synth markets.
 * @dev See IFeeConfigurationModule.
 */
contract MarketConfigurationModule is IMarketConfigurationModule {
    using SpotMarketFactory for SpotMarketFactory.Data;

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setAtomicFixedFee(uint128 synthMarketId, uint256 atomicFixedFee) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        MarketConfiguration.load(synthMarketId).atomicFixedFee = atomicFixedFee;

        emit AtomicFixedFeeSet(synthMarketId, atomicFixedFee);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getMarketFees(
        uint128 synthMarketId
    )
        external
        view
        override
        returns (uint256 atomicFixedFee, uint256 asyncFixedFee, int256 wrapFee, int256 unwrapFee)
    {
        MarketConfiguration.Data storage marketConfiguration = MarketConfiguration.load(
            synthMarketId
        );
        atomicFixedFee = marketConfiguration.atomicFixedFee;
        asyncFixedFee = marketConfiguration.asyncFixedFee;
        wrapFee = marketConfiguration.wrapFixedFee;
        unwrapFee = marketConfiguration.unwrapFixedFee;
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setAsyncFixedFee(uint128 synthMarketId, uint256 asyncFixedFee) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        MarketConfiguration.load(synthMarketId).asyncFixedFee = asyncFixedFee;

        emit AsyncFixedFeeSet(synthMarketId, asyncFixedFee);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setMarketSkewScale(uint128 synthMarketId, uint256 skewScale) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        MarketConfiguration.load(synthMarketId).skewScale = skewScale;

        emit MarketSkewScaleSet(synthMarketId, skewScale);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getMarketSkewScale(
        uint128 synthMarketId
    ) external view override returns (uint256 skewScale) {
        skewScale = MarketConfiguration.load(synthMarketId).skewScale;
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setMarketUtilizationFees(
        uint128 synthMarketId,
        uint256 utilizationFeeRate
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        MarketConfiguration.load(synthMarketId).utilizationFeeRate = utilizationFeeRate;

        emit MarketUtilizationFeesSet(synthMarketId, utilizationFeeRate);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getMarketUtilizationFees(
        uint128 synthMarketId
    ) external view override returns (uint256 utilizationFeeRate) {
        utilizationFeeRate = MarketConfiguration.load(synthMarketId).utilizationFeeRate;
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setCollateralLeverage(
        uint128 synthMarketId,
        uint256 collateralLeverage
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);
        MarketConfiguration.isValidLeverage(collateralLeverage);

        MarketConfiguration.load(synthMarketId).collateralLeverage = collateralLeverage;

        emit CollateralLeverageSet(synthMarketId, collateralLeverage);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getCollateralLeverage(
        uint128 synthMarketId
    ) external view override returns (uint256 collateralLeverage) {
        collateralLeverage = MarketConfiguration.load(synthMarketId).collateralLeverage;
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setCustomTransactorFees(
        uint128 synthMarketId,
        address transactor,
        uint256 fixedFeeAmount
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);
        MarketConfiguration.setFixedFeeOverride(synthMarketId, transactor, fixedFeeAmount);

        emit TransactorFixedFeeSet(synthMarketId, transactor, fixedFeeAmount);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getCustomTransactorFees(
        uint128 synthMarketId,
        address transactor
    ) external view override returns (uint256 fixedFeeAmount) {
        fixedFeeAmount = MarketConfiguration.getFixedFeeOverride(synthMarketId, transactor);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setFeeCollector(uint128 synthMarketId, address feeCollector) external override {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.onlyMarketOwner(synthMarketId);
        if (feeCollector != address(0)) {
            if (
                !ERC165Helper.safeSupportsInterface(feeCollector, type(IFeeCollector).interfaceId)
            ) {
                revert InvalidFeeCollectorInterface(feeCollector);
            }
        }

        MarketConfiguration.load(synthMarketId).feeCollector = IFeeCollector(feeCollector);
        emit FeeCollectorSet(synthMarketId, feeCollector);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getFeeCollector(
        uint128 synthMarketId
    ) external view override returns (address feeCollector) {
        feeCollector = address(MarketConfiguration.load(synthMarketId).feeCollector);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function setWrapperFees(
        uint128 synthMarketId,
        int256 wrapFee,
        int256 unwrapFee
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        if (wrapFee + unwrapFee < 0) {
            revert InvalidWrapperFees();
        }

        MarketConfiguration.Data storage marketConfiguration = MarketConfiguration.load(
            synthMarketId
        );
        marketConfiguration.wrapFixedFee = wrapFee;
        marketConfiguration.unwrapFixedFee = unwrapFee;

        emit WrapperFeesSet(synthMarketId, wrapFee, unwrapFee);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function updateReferrerShare(
        uint128 synthMarketId,
        address referrer,
        uint256 sharePercentage
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        MarketConfiguration.load(synthMarketId).referrerShare[referrer] = sharePercentage;

        emit ReferrerShareUpdated(synthMarketId, referrer, sharePercentage);
    }

    /**
     * @inheritdoc IMarketConfigurationModule
     */
    function getReferrerShare(
        uint128 synthMarketId,
        address referrer
    ) external view override returns (uint256 sharePercentage) {
        sharePercentage = MarketConfiguration.load(synthMarketId).referrerShare[referrer];
    }
}
