//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";

// @see: https://github.com/Synthetixio/rewards-distributors
interface IPerpRewardDistributor is IRewardDistributor {
    // --- Views --- //

    /**
     * @notice Returns the id of the pool this was registered with.
     */
    function getPoolId() external view returns (uint128);

    /**
     * @notice Returns a list of pool collateral types this distributor was registered with.
     */
    function getPoolCollateralTypes() external view returns (address[] memory);

    // --- Mutative --- //

    /**
     * @notice Initializes the PerpRewardDistributor with references, name, token to distribute etc.
     */
    function initialize(
        address rewardManager,
        address perpMarket,
        uint128 poolId_,
        address[] calldata collateralTypes,
        address token_,
        string memory name_
    ) external;

    /**
     * @notice Set true to disable `payout` to revert on claim or false to allow. Only callable by pool owner.
     */
    function setShouldFailPayout(bool _shouldFailedPayout) external;

    /**
     * @notice Creates a new distribution entry for LPs of `collateralType` to `amount` of tokens.
     */
    function distributeRewards(address collateralType, uint256 amount) external;
}
