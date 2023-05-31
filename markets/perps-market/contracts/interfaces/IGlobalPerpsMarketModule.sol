//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IGlobalPerpsMarketModule {
    /**
     * @return maxCollateralAmount for the provided synth market id
     * @param synthMarketId id of the synth market
     */
    function getMaxCollateralAmountsForSynthMarket(
        uint128 synthMarketId
    ) external view returns (uint);

    /**
     * @return synthDeductionPriority list of synths that get deducted first when user's margin gets deducted
     */
    function getSynthDeductionPriorty() external view returns (uint128[] memory);

    /**
     * @param synthMarketId id of the synth market
     * @param collateralAmount amount of collateral
     */
    function setMaxCollateralForSynthMarketId(
        uint128 synthMarketId,
        uint collateralAmount
    ) external;

    /**
     * @param newSynthDeductionPriority a list with priorties with synths ids
     */
    function setSynthDeductionPriorty(uint128[] memory newSynthDeductionPriority) external;
}
