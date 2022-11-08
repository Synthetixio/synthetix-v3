//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing pools and assignments per account
interface IRewardsManagerModule {
    event RewardsDistributed(
        uint128 indexed poolId,
        address indexed token,
        address distributor,
        uint totalRewarded,
        uint start,
        uint duration
    );
    event RewardsClaimed(
        uint128 indexed poolId,
        address indexed token,
        uint128 indexed accountId,
        uint index,
        uint amountClaimed
    );

    /// @notice called by pool owner or an existing distributor to register rewards for vault participants
    function registerRewardsDistributor(
        uint128 poolId,
        address token,
        address distributor
    ) external;

    /// @notice called by pool owner or an existing distributor to set up rewards for vault participants
    function distributeRewards(
        uint128 poolId,
        address token,
        uint amount,
        uint start,
        uint duration
    ) external;

    /// @notice retrieves the amount of available rewards, and claims them to the caller's account.
    function claimRewards(
        uint128 poolId,
        address token,
        uint128 accountId
    ) external returns (uint[] memory);

    /// @notice retrieves the amount of available rewards.
    /// @dev this function should be called to get currently available rewards using `callStatic`
    function getAvailableRewards(
        uint128 poolId,
        address token,
        uint128 accountId
    ) external returns (uint[] memory);

    /// @notice returns the number of individual units of amount emitted per second per share for the given poolId, collateralType vault
    function getCurrentRewardAccumulation(uint128 poolId, address collateralType) external view returns (uint[] memory);
}
