//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Collateral configuration module.
 */
interface ICollateralConfigurationModule {
    /**
     * @notice Gets fired when max collateral amount for synth for all the markets is set by owner.
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @param maxCollateralAmount max amount that was set for the synth
     * @param upperLimitDiscount upper limit discount that was set for the synth
     * @param lowerLimitDiscount lower limit discount that was set for the synth
     * @param discountScalar discount scalar that was set for the synth
     */
    event CollateralConfigurationSet(
        uint128 indexed synthMarketId,
        uint256 maxCollateralAmount,
        uint256 upperLimitDiscount,
        uint256 lowerLimitDiscount,
        uint256 discountScalar
    );

    /**
     * @notice Sets the max collateral amount for a specific synth market.
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @param maxCollateralAmount Max collateral amount to set for the synth market id.
     * @param upperLimitDiscount Collateral value is discounted and capped at this value.  In % units.
     * @param lowerLimitDiscount Collateral value is discounted and at minimum, this value.  In % units.
     * @param discountScalar This value is used to scale the impactOnSkew of the collateral.
     */
    function setCollateralConfiguration(
        uint128 synthMarketId,
        uint256 maxCollateralAmount,
        uint256 upperLimitDiscount,
        uint256 lowerLimitDiscount,
        uint256 discountScalar
    ) external;

    /**
     * @notice Gets the max collateral amount for a specific synth market.
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @return maxCollateralAmount max collateral amount of the specified synth market id
     */
    function getCollateralConfiguration(
        uint128 synthMarketId
    )
        external
        view
        returns (
            uint256 maxCollateralAmount,
            uint256 upperLimitDiscount,
            uint256 lowerLimitDiscount,
            uint256 discountScalar
        );
}
