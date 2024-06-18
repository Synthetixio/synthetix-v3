//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";

// @see: https://github.com/Synthetixio/rewards-distributors
interface IPerpRewardDistributor is IRewardDistributor {
    // --- Errors --- //

    /// @notice Thrown when rewards `balance` does not meet distribute or payout requirements.
    /// @param amount Amount of reward tokens to payout or distribute
    /// @param balance Current internally tracked token balance
    error InsufficientRewardBalance(uint256 amount, uint256 balance);

    // --- Views --- //

    /// @notice Returns the id of the pool this was registered with.
    /// @return getPoolId Id of the pool this RD was registered with
    function getPoolId() external view returns (uint128);

    /// @notice Returns a list of pool collateral types this distributor was registered with.
    /// @return getPoolCollateralTypes An array of delegated pool collateral addresses to distribute to
    function getPoolCollateralTypes() external view returns (address[] memory);

    // --- Mutations --- //

    /// @notice Initializes the PerpRewardDistributor with references, name, token to distribute etc.
    /// @param rewardManager Address of the reward manager (i.e. Synthetix core proxy)
    /// @param perpMarket Address of the bfp market proxy
    /// @param poolId_ Id of the pool this RD was registered with
    /// @param collateralTypes An array of delegated pool collateral types to dstribute to
    /// @param payoutToken_ Reward token to distribute
    /// @param name_ Name of the reward distributor
    function initialize(
        address rewardManager,
        address perpMarket,
        uint128 poolId_,
        address[] calldata collateralTypes,
        address payoutToken_,
        string memory name_
    ) external;

    /// @notice Set true to disable `payout` to revert on claim or false to allow. Only callable by pool owner.
    /// @param _shouldFailedPayout True to fail subsequent payout calls, false otherwise
    function setShouldFailPayout(bool _shouldFailedPayout) external;

    /// @notice Creates a new distribution entry for LPs of `collateralType` to `amount` of tokens.
    /// @param collateralType Delegated collateral in pool to distribute rewards to
    /// @param amount Amount of reward tokens to distribute
    function distributeRewards(address collateralType, uint256 amount) external;
}
