//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {ICollateralConfigurationModule} from "../interfaces/ICollateralConfigurationModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {AddressUtil} from "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import {CollateralConfiguration} from "../storage/CollateralConfiguration.sol";

/**
 * @title Module for global Perps Market settings.
 * @dev See ICollateralConfigurationModule.
 */
contract CollateralConfigurationModule is ICollateralConfigurationModule {
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using SetUtil for SetUtil.UintSet;

    // using KeeperCosts for KeeperCosts.Data;

    /**
     * @inheritdoc ICollateralConfigurationModule
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
     * @inheritdoc ICollateralConfigurationModule
     */
    function getCollateralConfiguration(
        uint128 synthMarketId
    ) external view override returns (uint256 maxCollateralAmount) {
        // TODO: move to collateral configuration module
        maxCollateralAmount = CollateralConfiguration.load(synthMarketId).maxAmount;
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
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
     * @inheritdoc ICollateralConfigurationModule
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
     * @inheritdoc ICollateralConfigurationModule
     */
    function getSynthDeductionPriority() external view override returns (uint128[] memory) {
        return GlobalPerpsMarketConfiguration.load().synthDeductionPriority;
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function setCollateralLiquidateRewardRatio(
        uint128 collateralLiquidateRewardRatioD18
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration
            .load()
            .collateralLiquidateRewardRatioD18 = collateralLiquidateRewardRatioD18;

        emit CollateralLiquidateRewardRatioSet(collateralLiquidateRewardRatioD18);
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function getCollateralLiquidateRewardRatio()
        external
        view
        override
        returns (uint128 collateralLiquidateRewardRatioD18)
    {
        return GlobalPerpsMarketConfiguration.load().collateralLiquidateRewardRatioD18;
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
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
     * @inheritdoc ICollateralConfigurationModule
     */
    function setRewardDistributorImplementation(
        address rewardDistributorImplementation
    ) external override {
        if (rewardDistributorImplementation == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (!AddressUtil.isContract(rewardDistributorImplementation)) {
            revert AddressError.NotAContract(rewardDistributorImplementation);
        }

        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration
            .load()
            .rewardDistributorImplementation = rewardDistributorImplementation;

        emit RewardDistributorImplementationSet(rewardDistributorImplementation);
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function getRewardDistributorImplementation()
        external
        view
        override
        returns (address rewardDistributorImplementation)
    {
        return GlobalPerpsMarketConfiguration.load().rewardDistributorImplementation;
    }
}
