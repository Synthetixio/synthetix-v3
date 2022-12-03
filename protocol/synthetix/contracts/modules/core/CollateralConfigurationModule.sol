//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

import "../../interfaces/ICollateralConfigurationModule.sol";
import "../../storage/CollateralConfiguration.sol";

/**
 * @title Module for configuring system wide collateral.
 * @dev See ICollateralConfigurationModule.
 */
contract CollateralConfigurationModule is ICollateralConfigurationModule {
    using SetUtil for SetUtil.AddressSet;
    using CollateralConfiguration for CollateralConfiguration.Data;

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function configureCollateral(CollateralConfiguration.Data memory config) external override {
        OwnableStorage.onlyOwner();

        CollateralConfiguration.set(config);

        emit CollateralConfigured(config.tokenAddress, config);
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function getCollateralConfigurations(
        bool hideDisabled
    ) external view override returns (CollateralConfiguration.Data[] memory) {
        SetUtil.AddressSet storage collateralTypes = CollateralConfiguration
            .loadAvailableCollaterals();

        uint numCollaterals = collateralTypes.length();
        CollateralConfiguration.Data[]
            memory filteredCollaterals = new CollateralConfiguration.Data[](numCollaterals);

        uint collateralsIdx;
        for (uint i = 1; i <= numCollaterals; i++) {
            address collateralType = collateralTypes.valueAt(i);

            CollateralConfiguration.Data storage collateral = CollateralConfiguration.load(
                collateralType
            );

            if (!hideDisabled || collateral.depositingEnabled) {
                filteredCollaterals[collateralsIdx++] = collateral;
            }
        }

        return filteredCollaterals;
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    // Note: Disabling Solidity warning, not sure why it suggests pure mutability.
    // solc-ignore-next-line func-mutability
    function getCollateralConfiguration(
        address collateralType
    ) external view override returns (CollateralConfiguration.Data memory) {
        return CollateralConfiguration.load(collateralType);
    }

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function getCollateralPrice(address collateralType) external view override returns (uint) {
        return
            CollateralConfiguration.getCollateralPrice(
                CollateralConfiguration.load(collateralType)
            );
    }
}
