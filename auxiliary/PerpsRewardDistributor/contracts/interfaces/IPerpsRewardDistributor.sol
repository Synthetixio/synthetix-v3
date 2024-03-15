// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";

interface IPerpRewardDistributor is IRewardDistributor {
    /**
     * @notice Returns the version of the PerpRewardDistributor.
     * @return The Semver contract version as a string.
     */
    function version() external view returns (string memory);

    /**
     * @notice Returns the id of the pool this was registered with.
     */
    function getPoolId() external view returns (uint128);

    /**
     * @notice Initializes the PerpRewardDistributor with references, name, token to distribute etc.
     */
    function initialize(
        address rewardManager,
        address perpMarket,
        uint128 poolId_,
        address token_,
        string memory name_
    ) external;

    /**
     * @notice Set true to disable `payout` to revert on claim or false to allow.
     */
    function setShouldFailPayout(bool _shouldFailedPayout) external;

    /**
     * @notice Creates a new distribution entry for LPs of `collateralType` to `amount` of tokens.
     */
    function distributeRewards(address collateralType, uint256 amount) external;
}
