//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for global Perps Market settings.
 */
interface IGlobalPerpsMarketModule {
    /**
     * @notice Gets fired when max collateral amount for synth for all the markets is set by owner.
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @param collateralAmount max amount that was set for the synth
     */
    event MaxCollateralAmountSet(uint128 indexed synthMarketId, uint256 collateralAmount);

    /**
     * @notice Gets fired when the synth deduction priority is updated by owner.
     * @param newSynthDeductionPriority new synth id priority order for deductions.
     */
    event SynthDeductionPrioritySet(uint128[] newSynthDeductionPriority);

    /**
     * @notice Gets fired when liquidation reward guard is set or updated.
     * @param minLiquidationRewardUsd Minimum liquidation reward expressed as USD value.
     * @param maxLiquidationRewardUsd Maximum liquidation reward expressed as USD value.
     */
    event LiquidationRewardGuardsSet(
        uint256 indexed minLiquidationRewardUsd,
        uint256 indexed maxLiquidationRewardUsd
    );

    /**
     * @notice Sets the max collateral amount for a specific synth market.
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @param collateralAmount Max collateral amount to set for the synth market id.
     */
    function setMaxCollateralAmount(uint128 synthMarketId, uint collateralAmount) external;

    /**
     * @notice Obtain the max collateral amount for a specific synth market.
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @return maxCollateralAmount max collateral amount of the specified synth market id
     */
    function getMaxCollateralAmount(uint128 synthMarketId) external view returns (uint);

    /**
     * @notice Sets the synth deduction priority ordered list.
     * @dev The synth deduction priority is used to determine the order in which synths are deducted from an account. Id 0 is snxUSD and should be first in the list.
     * @param newSynthDeductionPriority Ordered array of synth market ids for deduction priority.
     */
    function setSynthDeductionPriority(uint128[] memory newSynthDeductionPriority) external;

    function getSynthDeductionPriority() external view returns (uint128[] memory);

    function setLiquidationRewardGuards(
        uint256 minLiquidationRewardUsd,
        uint256 maxLiquidationRewardUsd
    ) external;

    function getLiquidationRewardGuards()
        external
        view
        returns (uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd);
}
