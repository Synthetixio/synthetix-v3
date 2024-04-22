//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ICollateralConfigurationModule} from "../interfaces/ICollateralConfigurationModule.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {LiquidationAssetManager} from "../storage/LiquidationAssetManager.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {AddressUtil} from "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import {PerpsCollateralConfiguration} from "../storage/PerpsCollateralConfiguration.sol";
import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {RewardsDistributor} from "@synthetixio/rewards-distributor/src/RewardsDistributor.sol";

import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {ERC165Helper} from "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import {IDistributorErrors} from "../interfaces/IDistributorErrors.sol";

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
        GlobalPerpsMarketConfiguration.load().updateCollateralMax(
            collateralId,
            maxCollateralAmount
        );

        PerpsCollateralConfiguration.load(collateralId).setDiscounts(
            upperLimitDiscount,
            lowerLimitDiscount,
            discountScalar
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
