//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for setting max collateral distribution.
 */
interface ICollateralModule {
    /**
     * @notice Gets fired when max collateral amount for synth is set by owner.
     * @param synthId Synth market id, 0 for snxUSD.
     * @param maxCollateralAmount max amount that was set for the synth
     */
    event MaxCollateralSet(uint128 indexed synthId, uint256 maxCollateralAmount);

    /**
     * @notice Set the max collateral amoutn via this function
     * @param synthId Synth market id, 0 for snxUSD.
     * @param maxCollateralAmount max amount that for the synth
     */
    function setMaxCollateralAmount(uint128 synthId, uint maxCollateralAmount) external;
}
