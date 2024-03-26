//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Collateral configuration module.
 */
interface ICollateralConfigurationModule {
    /**
     * @notice Gets fired when max collateral amount for synth for all the markets is set by owner.
     * @param collateralId Synth market id to use as collateral, 0 for snxUSD.
     * @param maxCollateralAmount max amount that was set for the synth
     * @param upperLimitDiscount upper limit discount that was set for the synth
     * @param lowerLimitDiscount lower limit discount that was set for the synth
     * @param discountScalar discount scalar that was set for the synth
     */
    event CollateralConfigurationSet(
        uint128 indexed collateralId,
        uint256 maxCollateralAmount,
        uint256 upperLimitDiscount,
        uint256 lowerLimitDiscount,
        uint256 discountScalar
    );

    /**
     * @notice Gets fired when the collateral liquidation reward ratio is updated.
     * @param collateralLiquidateRewardRatioD18 new collateral liquidation reward ratio.
     */
    event CollateralLiquidateRewardRatioSet(uint128 collateralLiquidateRewardRatioD18);

    /**
     * @notice Gets fired when a new reward distributor is registered.
     * @param distributor the new distributor address.
     */
    event RewardDistributorRegistered(address distributor);

    /**
     * @notice Sets the max collateral amount for a specific synth market.
     * @param collateralId Synth market id to use as collateral, 0 for snxUSD.
     * @param maxCollateralAmount Max collateral amount to set for the synth market id.
     * @param upperLimitDiscount Collateral value is discounted and capped at this value.  In % units.
     * @param lowerLimitDiscount Collateral value is discounted and at minimum, this value.  In % units.
     * @param discountScalar This value is used to scale the impactOnSkew of the collateral.
     */
    function setCollateralConfiguration(
        uint128 collateralId,
        uint256 maxCollateralAmount,
        uint256 upperLimitDiscount,
        uint256 lowerLimitDiscount,
        uint256 discountScalar
    ) external;

    /**
     * @notice Gets the max collateral amount for a specific synth market.
     * @param collateralId Synth market id, 0 for snxUSD.
     * @return maxCollateralAmount max collateral amount of the specified synth market id
     */
    function getCollateralConfiguration(
        uint128 collateralId
    )
        external
        view
        returns (
            uint256 maxCollateralAmount,
            uint256 upperLimitDiscount,
            uint256 lowerLimitDiscount,
            uint256 discountScalar
        );

    /**
     * @notice Sets the collateral liquidation reward ratio.
     * @param collateralLiquidateRewardRatioD18 the new collateral liquidation reward ratio.
     */
    function setCollateralLiquidateRewardRatio(uint128 collateralLiquidateRewardRatioD18) external;

    /**
     * @notice Gets the collateral liquidation reward ratio.
     */
    function getCollateralLiquidateRewardRatio()
        external
        view
        returns (uint128 collateralLiquidateRewardRatioD18);

    /**
     * @notice Registers a new reward distributor.
     * @param token the collateral token address.
     * @param distributor the previous distributor address if there was one. Set it to address(0) if first distributor, or need to create a new clone.
     * @param collateralId the collateral id.
     * @param poolDelegatedCollateralTypes the pool delegated collateral types.
     */
    function registerDistributor(
        address token,
        address distributor,
        uint128 collateralId,
        address[] calldata poolDelegatedCollateralTypes
    ) external;

    /**
     * @notice Checks if a distributor is registered.
     * @param distributor the distributor address.
     * @return isRegistered true if the distributor is registered.
     */
    function isRegistered(address distributor) external view returns (bool);

    /**
     * @notice Gets the registered distributor for a collateral id.
     * @param collateralId the collateral id.
     * @return distributor the distributor address.
     * @return poolDelegatedCollateralTypes the pool delegated collateral types.
     */
    function getRegisteredDistributor(
        uint128 collateralId
    ) external view returns (address distributor, address[] memory poolDelegatedCollateralTypes);
}
