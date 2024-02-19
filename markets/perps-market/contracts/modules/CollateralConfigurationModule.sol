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
import {CollateralConfiguration} from "../storage/CollateralConfiguration.sol";
import {IPerpRewardDistributor} from "@synthetixio/perps-reward-distributor/contracts/interfaces/IPerpsRewardDistributor.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {Clones} from "../utils/Clones.sol";
import {ERC165Helper} from "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import {IDistributorErrors} from "../interfaces/IDistributorErrors.sol";

/**
 * @title Module for global Perps Market settings.
 * @dev See ICollateralConfigurationModule.
 */
contract CollateralConfigurationModule is ICollateralConfigurationModule {
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using SetUtil for SetUtil.UintSet;
    using LiquidationAssetManager for LiquidationAssetManager.Data;
    using Clones for address;

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

        if (
            !ERC165Helper.safeSupportsInterface(
                rewardDistributorImplementation,
                type(IPerpRewardDistributor).interfaceId
            )
        ) {
            revert IDistributorErrors.InvalidDistributorContract(rewardDistributorImplementation);
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

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function registerDistributor(
        uint128 poolId,
        address token,
        address previousDistributor,
        string calldata name,
        uint128 collateralId,
        address[] calldata poolDelegatedCollateralTypes
    ) external override returns (address) {
        OwnableStorage.onlyOwner();
        // Using loadValid here to ensure we are tying the distributor to a valid collateral.
        LiquidationAssetManager.Data storage lam = CollateralConfiguration
            .loadValid(collateralId)
            .lam;

        lam.id = collateralId;

        // validate and set poolDelegatedCollateralTypes
        lam.setValidPoolDelegatedCollateralTypes(poolDelegatedCollateralTypes);

        // reuse current or clone distributor
        lam.setValidDistributor(previousDistributor);

        // A reward token to distribute must exist.
        if (token == address(0)) {
            revert AddressError.ZeroAddress();
        }

        IPerpRewardDistributor distributor = IPerpRewardDistributor(lam.distributor);
        distributor.initialize(
            address(PerpsMarketFactory.load().synthetix),
            address(this),
            poolId,
            token,
            name
        );

        emit RewardDistributorRegistered(lam.distributor);
        return lam.distributor;
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function isRegistered(address distributor) external view override returns (bool) {
        return distributor != address(0) && IPerpRewardDistributor(distributor).getPoolId() != 0;
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
        LiquidationAssetManager.Data storage lam = CollateralConfiguration.loadValidLam(
            collateralId
        );
        distributor = lam.distributor;
        poolDelegatedCollateralTypes = lam.poolDelegatedCollateralTypes;
    }
}
