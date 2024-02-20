//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ICollateralConfigurationModule} from "../interfaces/ICollateralConfigurationModule.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";

/**
 * @title Module for collateral configuration setters/getters.
 * @dev See ICollateralConfigurationModule.
 */
contract CollateralConfigurationModule is ICollateralConfigurationModule {
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;

    /**
     * @inheritdoc ICollateralConfigurationModule
     */
    function setCollateralConfiguration(
        uint128 synthMarketId,
        uint256 maxCollateralAmount,
        uint256 upperLimitDiscount,
        uint256 lowerLimitDiscount,
        uint256 discountScalar
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.load().updateCollateralMax(
            synthMarketId,
            maxCollateralAmount
        );

        CollateralConfiguration.load(synthMarketId).setDiscounts(
            upperLimitDiscount,
            lowerLimitDiscount,
            discountScalar
        );

        emit CollateralConfigurationSet(
            synthMarketId,
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
        uint128 synthMarketId
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
        return CollateralConfiguration.load(synthMarketId).getConfig();
    }
}
