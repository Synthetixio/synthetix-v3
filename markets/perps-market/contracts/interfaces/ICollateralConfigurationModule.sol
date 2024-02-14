//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for global Collateral settings.
 */
interface ICollateralConfigurationModule {
    /**
     * @notice Gets fired when max collateral amount for synth for all the markets is set by owner.
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @param maxCollateralAmount max amount that was set for the synth
     */
    event CollateralConfigurationSet(uint128 indexed synthMarketId, uint256 maxCollateralAmount);

    /**
     * @notice Gets fired when TODO.
     * @param collateralLiquidateRewardRatioD18 TODO
     */
    event CollateralLiquidateRewardRatioSet(uint128 collateralLiquidateRewardRatioD18);

    /**
     * @notice Gets fired when TODO.
     * @param rewardDistributorImplementation TODO
     */
    event RewardDistributorImplementationSet(address rewardDistributorImplementation);

    /**
     * @notice Gets fired when the synth deduction priority is updated by owner.
     * @param newSynthDeductionPriority new synth id priority order for deductions.
     */
    event SynthDeductionPrioritySet(uint128[] newSynthDeductionPriority);

    /**
     * @notice Sets the synth deduction priority ordered list.
     * @dev The synth deduction priority is used to determine the order in which synths are deducted from an account. Id 0 is snxUSD and should be first in the list.
     * @param newSynthDeductionPriority Ordered array of synth market ids for deduction priority.
     */
    function setSynthDeductionPriority(uint128[] memory newSynthDeductionPriority) external;

    /**
     * @notice Gets the synth deduction priority ordered list.
     * @dev The synth deduction priority is used to determine the order in which synths are deducted from an account. Id 0 is snxUSD and should be first in the list.
     * @return synthDeductionPriority Ordered array of synth market ids for deduction priority.
     */
    function getSynthDeductionPriority() external view returns (uint128[] memory);

    /**
     * @notice Sets the max collateral amount for a specific synth market.
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @param maxCollateralAmount Max collateral amount to set for the synth market id.
     */
    function setCollateralConfiguration(uint128 synthMarketId, uint maxCollateralAmount) external;

    /**
     * @notice Gets the max collateral amount for a specific synth market.
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @return maxCollateralAmount max collateral amount of the specified synth market id
     */
    function getCollateralConfiguration(
        uint128 synthMarketId
    ) external view returns (uint256 maxCollateralAmount);

    /**
     * @notice Gets the list of supported collaterals.
     * @return supportedCollaterals list of supported collateral ids. By supported collateral we mean a collateral which max is greater than zero
     */
    function getSupportedCollaterals()
        external
        view
        returns (uint256[] memory supportedCollaterals);

    /**
     * @notice Gets the total collateral value of all deposited collateral from all traders.
     * @return totalCollateralValue value of all collateral
     */
    function totalGlobalCollateralValue() external view returns (uint256 totalCollateralValue);

    function setCollateralLiquidateRewardRatio(uint128 collateralLiquidateRewardRatioD18) external;

    function getCollateralLiquidateRewardRatio()
        external
        view
        returns (uint128 collateralLiquidateRewardRatioD18);

    function setRewardDistributorImplementation(address rewardDistributorImplementation) external;

    function getRewardDistributorImplementation()
        external
        view
        returns (address rewardDistributorImplementation);
}
