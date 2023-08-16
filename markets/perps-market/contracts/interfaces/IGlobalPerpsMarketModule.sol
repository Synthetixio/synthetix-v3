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
     * @notice emitted when custom fee collector is set
     * @param feeCollector the address of the fee collector to set.
     */
    event FeeCollectorSet(address feeCollector);

    /**
     * @notice Emitted when the share percentage for a referrer address has been updated.
     * @param referrer The address of the referrer
     * @param shareRatioD18 The new share ratio for the referrer
     */
    event ReferrerShareUpdated(address referrer, uint256 shareRatioD18);

    /**
     * @notice Gets fired when the max number of Positions and Collaterals per Account are set by owner.
     * @param maxPositionsPerAccount The max number of concurrent Positions per Account
     * @param maxCollateralsPerAccount The max number of concurrent Collaterals per Account
     */
    event PerAccountCapsSet(uint128 maxPositionsPerAccount, uint128 maxCollateralsPerAccount);

    /**
     * @notice Thrown when the fee collector does not implement the IFeeCollector interface
     */
    error InvalidFeeCollectorInterface(address invalidFeeCollector);

    /**
     * @notice Thrown when a referrer share gets set to larger than 100%
     */
    error InvalidReferrerShareRatio(uint256 shareRatioD18);

    /**
     * @notice Sets the max collateral amount for a specific synth market.
     * @param synthMarketId Synth market id, 0 for snxUSD.
     * @param collateralAmount Max collateral amount to set for the synth market id.
     */
    function setMaxCollateralAmount(uint128 synthMarketId, uint collateralAmount) external;

    /**
     * @notice Gets the max collateral amount for a specific synth market.
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

    /**
     * @notice Gets the synth deduction priority ordered list.
     * @dev The synth deduction priority is used to determine the order in which synths are deducted from an account. Id 0 is snxUSD and should be first in the list.
     * @return synthDeductionPriority Ordered array of synth market ids for deduction priority.
     */
    function getSynthDeductionPriority() external view returns (uint128[] memory);

    /**
     * @notice Sets the liquidation reward guard (min and max).
     * @param minLiquidationRewardUsd Minimum liquidation reward expressed as USD value.
     * @param maxLiquidationRewardUsd Maximum liquidation reward expressed as USD value.
     */
    function setLiquidationRewardGuards(
        uint256 minLiquidationRewardUsd,
        uint256 maxLiquidationRewardUsd
    ) external;

    /**
     * @notice Gets the liquidation reward guard (min and max).
     * @return minLiquidationRewardUsd Minimum liquidation reward expressed as USD value.
     * @return maxLiquidationRewardUsd Maximum liquidation reward expressed as USD value.
     */
    function getLiquidationRewardGuards()
        external
        view
        returns (uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd);

    /**
     * @notice Gets the total collateral value of all deposited collateral from all traders.
     * @return totalCollateralValue value of all collateral
     */
    function totalGlobalCollateralValue() external view returns (uint256 totalCollateralValue);

    /**
     * @notice Sets the fee collector contract.
     * @dev must conform to the IFeeCollector interface
     * @param feeCollector address of the fee collector contract
     */
    function setFeeCollector(address feeCollector) external;

    /**
     * @notice Gets the configured feeCollector contract
     * @return feeCollector address of the fee collector contract
     */
    function getFeeCollector() external view returns (address feeCollector);

    /**
     * @notice Set or update the max number of Positions and Collaterals per Account
     * @param maxPositionsPerAccount The max number of concurrent Positions per Account
     * @param maxCollateralsPerAccount The max number of concurrent Collaterals per Account
     */
    function setPerAccountCaps(
        uint128 maxPositionsPerAccount,
        uint128 maxCollateralsPerAccount
    ) external;

    /**
     * @notice get the max number of Positions and Collaterals per Account
     * @param maxPositionsPerAccount The max number of concurrent Positions per Account
     * @param maxCollateralsPerAccount The max number of concurrent Collaterals per Account
     */
    function getPerAccountCaps()
        external
        returns (uint128 maxPositionsPerAccount, uint128 maxCollateralsPerAccount);

    /**
     * @notice Update the referral share percentage for a referrer
     * @param referrer The address of the referrer
     * @param shareRatioD18 The new share percentage for the referrer
     */
    function updateReferrerShare(address referrer, uint256 shareRatioD18) external;

    /**
     * @notice get the referral share percentage for the specified referrer
     * @param referrer The address of the referrer
     * @return shareRatioD18 The configured share percentage for the referrer
     */
    function getReferrerShare(address referrer) external returns (uint256 shareRatioD18);

    /**
     * @notice get all existing market ids
     * @return marketIds an array of existing market ids
     */
    function getMarkets() external returns (uint256[] memory marketIds);
}
