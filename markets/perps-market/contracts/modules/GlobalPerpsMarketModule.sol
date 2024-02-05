//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {ERC165Helper} from "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {IFeeCollector} from "../interfaces/external/IFeeCollector.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {InterestRate} from "../storage/InterestRate.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {IGlobalPerpsMarketModule} from "../interfaces/IGlobalPerpsMarketModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {KeeperCosts} from "../storage/KeeperCosts.sol";
import {CollateralConfiguration} from "../storage/CollateralConfiguration.sol";

/**
 * @title Module for global Perps Market settings.
 * @dev See IGlobalPerpsMarketModule.
 */
contract GlobalPerpsMarketModule is IGlobalPerpsMarketModule {
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using SetUtil for SetUtil.UintSet;
    using KeeperCosts for KeeperCosts.Data;

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setCollateralConfiguration(
        uint128 synthMarketId,
        uint256 maxCollateralAmount
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.load().updateCollateral(synthMarketId, maxCollateralAmount);

        emit CollateralConfigurationSet(synthMarketId, maxCollateralAmount);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getCollateralConfiguration(
        uint128 synthMarketId
    ) external view override returns (uint256 maxCollateralAmount) {
        // TODO: move to collateral configuration module
        maxCollateralAmount = CollateralConfiguration.load(synthMarketId).maxAmount;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getSupportedCollaterals()
        external
        view
        override
        returns (uint256[] memory supportedCollaterals)
    {
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        supportedCollaterals = store.supportedCollateralTypes.values();
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setSynthDeductionPriority(
        uint128[] memory newSynthDeductionPriority
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.load().updateSynthDeductionPriority(
            newSynthDeductionPriority
        );

        emit SynthDeductionPrioritySet(newSynthDeductionPriority);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getSynthDeductionPriority() external view override returns (uint128[] memory) {
        return GlobalPerpsMarketConfiguration.load().synthDeductionPriority;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setKeeperRewardGuards(
        uint256 minKeeperRewardUsd,
        uint256 minKeeperProfitRatioD18,
        uint256 maxKeeperRewardUsd,
        uint256 maxKeeperScalingRatioD18
    ) external override {
        OwnableStorage.onlyOwner();
        if (minKeeperRewardUsd > maxKeeperRewardUsd) {
            revert ParameterError.InvalidParameter("min/maxKeeperRewardUSD", "min > max");
        }

        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.minKeeperRewardUsd = minKeeperRewardUsd;
        store.minKeeperProfitRatioD18 = minKeeperProfitRatioD18;
        store.maxKeeperRewardUsd = maxKeeperRewardUsd;
        store.maxKeeperScalingRatioD18 = maxKeeperScalingRatioD18;

        emit KeeperRewardGuardsSet(
            minKeeperRewardUsd,
            minKeeperProfitRatioD18,
            maxKeeperRewardUsd,
            maxKeeperScalingRatioD18
        );
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getKeeperRewardGuards()
        external
        view
        override
        returns (
            uint256 minKeeperRewardUsd,
            uint256 minKeeperProfitRatioD18,
            uint256 maxKeeperRewardUsd,
            uint256 maxKeeperScalingRatioD18
        )
    {
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        minKeeperRewardUsd = store.minKeeperRewardUsd;
        minKeeperProfitRatioD18 = store.minKeeperProfitRatioD18;
        maxKeeperRewardUsd = store.maxKeeperRewardUsd;
        maxKeeperScalingRatioD18 = store.maxKeeperScalingRatioD18;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function totalGlobalCollateralValue()
        external
        view
        override
        returns (uint256 totalCollateralValue)
    {
        return GlobalPerpsMarket.load().totalCollateralValue();
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setFeeCollector(address feeCollector) external override {
        OwnableStorage.onlyOwner();
        if (feeCollector != address(0)) {
            if (
                !ERC165Helper.safeSupportsInterface(feeCollector, type(IFeeCollector).interfaceId)
            ) {
                revert InvalidFeeCollectorInterface(feeCollector);
            }
        }

        GlobalPerpsMarketConfiguration.load().feeCollector = IFeeCollector(feeCollector);
        emit FeeCollectorSet(feeCollector);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getFeeCollector() external view override returns (address feeCollector) {
        return address(GlobalPerpsMarketConfiguration.load().feeCollector);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function updateKeeperCostNodeId(bytes32 keeperCostNodeId) external override {
        OwnableStorage.onlyOwner();

        KeeperCosts.load().update(keeperCostNodeId);

        emit KeeperCostNodeIdUpdated(keeperCostNodeId);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getKeeperCostNodeId() external view override returns (bytes32 keeperCostNodeId) {
        return KeeperCosts.load().keeperCostNodeId;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function updateReferrerShare(address referrer, uint256 shareRatioD18) external override {
        OwnableStorage.onlyOwner();

        if (shareRatioD18 > DecimalMath.UNIT) {
            revert InvalidReferrerShareRatio(shareRatioD18);
        }

        if (referrer == address(0)) {
            revert AddressError.ZeroAddress();
        }

        GlobalPerpsMarketConfiguration.load().referrerShare[referrer] = shareRatioD18;

        emit ReferrerShareUpdated(referrer, shareRatioD18);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getReferrerShare(
        address referrer
    ) external view override returns (uint256 shareRatioD18) {
        return GlobalPerpsMarketConfiguration.load().referrerShare[referrer];
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getMarkets() external view override returns (uint256[] memory marketIds) {
        marketIds = GlobalPerpsMarket.load().activeMarkets.values();
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setPerAccountCaps(
        uint128 maxPositionsPerAccount,
        uint128 maxCollateralsPerAccount
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.maxPositionsPerAccount = maxPositionsPerAccount;
        store.maxCollateralsPerAccount = maxCollateralsPerAccount;

        emit PerAccountCapsSet(maxPositionsPerAccount, maxCollateralsPerAccount);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getPerAccountCaps()
        external
        view
        override
        returns (uint128 maxPositionsPerAccount, uint128 maxCollateralsPerAccount)
    {
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        maxPositionsPerAccount = store.maxPositionsPerAccount;
        maxCollateralsPerAccount = store.maxCollateralsPerAccount;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setInterestRateParameters(
        uint128 lowUtilizationInterestRateGradient,
        uint128 interestRateGradientBreakpoint,
        uint128 highUtilizationInterestRateGradient
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();

        if (lowUtilizationInterestRateGradient > highUtilizationInterestRateGradient) {
            revert InvalidInterestRateParameters(
                lowUtilizationInterestRateGradient,
                highUtilizationInterestRateGradient
            );
        }

        store.lowUtilizationInterestRateGradient = lowUtilizationInterestRateGradient;
        store.interestRateGradientBreakpoint = interestRateGradientBreakpoint;
        store.highUtilizationInterestRateGradient = highUtilizationInterestRateGradient;

        emit InterestRateParametersSet(
            lowUtilizationInterestRateGradient,
            interestRateGradientBreakpoint,
            highUtilizationInterestRateGradient
        );
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getInterestRateParameters()
        external
        view
        override
        returns (
            uint128 lowUtilizationInterestRateGradient,
            uint128 interestRateGradientBreakpoint,
            uint128 highUtilizationInterestRateGradient
        )
    {
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        lowUtilizationInterestRateGradient = store.lowUtilizationInterestRateGradient;
        interestRateGradientBreakpoint = store.interestRateGradientBreakpoint;
        highUtilizationInterestRateGradient = store.highUtilizationInterestRateGradient;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function updateInterestRate() external override {
        (uint128 interestRate, ) = InterestRate.update();

        emit InterestRateUpdated(PerpsMarketFactory.load().perpsMarketId, interestRate);
    }
}
