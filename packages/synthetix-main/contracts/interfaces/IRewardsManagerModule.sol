//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing pools and assignments per account
interface IRewardsManagerModule {
    event RewardsDistributed(
        uint128 indexed poolId,
        address indexed collateralType,
        address distributor,
        uint totalRewarded,
        uint start,
        uint duration
    );
    event RewardsClaimed(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address indexed collateralType,
        address distributor,
        uint amountClaimed
    );

    /// @notice called by pool owner or an existing distributor to register rewards for vault participants
    function registerRewardsDistributor(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external;

    /// @notice called by pool owner or an existing distributor to set up rewards for vault participants
    function distributeRewards(
        uint128 poolId,
        address collateralType,
        uint amount,
        uint start,
        uint duration
    ) external;

    /// @notice retrieves the amount of available rewards, and claims them to the caller's account.
    function claimAllRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId
    ) external returns (uint[] memory);

    /// @notice retrieves the amount of available rewards, and claims them to the caller's account for a single distributor.
    function claimRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        address distributor
    ) external returns (uint);

    /// @notice retrieves the amount of available rewards.
    /// @dev this function should be called to get currently available rewards using `callStatic`
    function getAvailableRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId
    ) external returns (uint[] memory, address[] memory);

    /// @notice returns the number of individual units of amount emitted per second per share for the given poolId, collateralType vault
    function getCurrentRewardRate(uint128 poolId, address collateralType) external view returns (uint[] memory);
}
