//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ICollateralConfigurationModule} from "../interfaces/ICollateralConfigurationModule.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {LiquidationAssetManager} from "../storage/LiquidationAssetManager.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {PerpsCollateralConfiguration} from "../storage/PerpsCollateralConfiguration.sol";
import {RewardsDistributor} from "@synthetixio/rewards-distributor/src/RewardsDistributor.sol";

/**
 * @title Module for collateral configuration setters/getters.
 * @dev See ICollateralConfigurationModule.
 */
contract CollateralConfigurationModule is ICollateralConfigurationModule {
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using SetUtil for SetUtil.UintSet;
    using LiquidationAssetManager for LiquidationAssetManager.Data;
    using PerpsCollateralConfiguration for PerpsCollateralConfiguration.Data;

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function setCollateralConfiguration(
        uint128 collateralId,
        uint256 maxCollateralAmount,
        uint256 upperLimitDiscount,
        uint256 lowerLimitDiscount,
        uint256 discountScalar
    ) external override {
        OwnableStorage.onlyOwner();
        PerpsCollateralConfiguration.Data storage collateralConfig = PerpsCollateralConfiguration
            .load(collateralId);

        collateralConfig.setMax(collateralId, maxCollateralAmount);
        collateralConfig.setDiscounts(upperLimitDiscount, lowerLimitDiscount, discountScalar);

        GlobalPerpsMarketConfiguration.load().updateSupportedCollaterals(
            collateralId,
            maxCollateralAmount
        );

        emit CollateralConfigurationSet(
            collateralId,
            maxCollateralAmount,
            upperLimitDiscount,
            lowerLimitDiscount,
            discountScalar
        );
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function getCollateralConfiguration(
        uint128 collateralId
    ) external view override returns (uint256 maxCollateralAmount) {
        return PerpsCollateralConfiguration.load(collateralId).maxAmount;
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function getCollateralConfigurationFull(
        uint128 collateralId
    )
        external
        view
        override
        returns (
            uint256 maxCollateralAmount,
            uint256 upperLimitDiscount,
            uint256 lowerLimitDiscount,
            uint256 discountScalar
        )
    {
        return PerpsCollateralConfiguration.load(collateralId).getConfig();
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
    function registerDistributor(
        address token,
        address distributor,
        uint128 collateralId,
        address[] calldata poolDelegatedCollateralTypes
    ) external override {
        OwnableStorage.onlyOwner();
        // A reward token to distribute must exist.
        if (token == address(0)) {
            revert AddressError.ZeroAddress();
        }

        // Using loadValid here to ensure we are tying the distributor to a valid collateral.
        LiquidationAssetManager.Data storage lam = PerpsCollateralConfiguration
            .loadValid(collateralId)
            .lam;

        lam.id = collateralId;

        // validate and set poolDelegatedCollateralTypes
        lam.setValidPoolDelegatedCollateralTypes(poolDelegatedCollateralTypes);

        // reuse current or clone distributor
        lam.setValidDistributor(distributor, token);

        emit RewardDistributorRegistered(distributor);
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function isRegistered(address distributor) external view override returns (bool) {
        return distributor != address(0) && RewardsDistributor(distributor).poolId() != 0;
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function getRegisteredDistributor(
        uint128 collateralId
    )
        external
        view
        override
        returns (address distributor, address[] memory poolDelegatedCollateralTypes)
    {
        LiquidationAssetManager.Data storage lam = PerpsCollateralConfiguration.loadValidLam(
            collateralId
        );
        distributor = lam.distributor;
        poolDelegatedCollateralTypes = lam.poolDelegatedCollateralTypes;
    }
}
