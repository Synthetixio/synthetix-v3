//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for setting max collateral distribution.
 */
interface ICollateralModule {
    /**
     * @notice Gets fired when max collateral amount for synth collateral for the system is set by owner.
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @param collateralAmount max amount that was set for the synth
     */
    event MaxCollateralSet(uint128 indexed synthMarketId, uint256 collateralAmount);

    /**
     * @notice Set the max collateral amoutn via this function
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @param collateralAmount max amount that for the synth
     */
    function setMaxCollateralAmount(uint128 synthMarketId, uint collateralAmount) external;
}
