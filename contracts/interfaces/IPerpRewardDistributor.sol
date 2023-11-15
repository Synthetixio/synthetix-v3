//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";

// @see: https://github.com/Synthetixio/rewards-distributors
interface IPerpRewardDistributor is IRewardDistributor {
    /**
     * @notice Initializes the PerpRewardDistributor with references, name, token to distribute etc.
     */
    function initialize(address rewardManager, address token, string memory name) external;

    /**
     * @notice Creates a new distribution entry for LPs of `collateralType` to `amount` of tokens.
     */
    function distributeRewards(uint128 poolId, address collateralType, uint256 amount) external;
}
