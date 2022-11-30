//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing pools and assignments per account
interface IRewardsManagerModule {
    event RewardsDistributed(
        uint128 indexed poolId,
        address indexed collateralType,
        address distributor,
        uint amount,
        uint start,
        uint duration
    );
    event RewardsClaimed(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address indexed collateralType,
        address distributor,
        uint amount
    );
    event RewardsDistributorRegistered(uint128 indexed poolId, address indexed collateralType, address indexed distributor);

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

    /// @notice retrieves the amount of available reward, and claims them to the caller's account for a given distributor.
    function claimRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        address distributor
    ) external returns (uint);

    /// @notice retrieves the amount of available rewards.
    /// @dev this function should be called to get currently available rewards using `callStatic`
    function getRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId
    ) external returns (uint[] memory, address[] memory);

    /// @notice returns the number of individual units of amount emitted per second per share for the given poolId, collateralType, distributor vault
    function getRewardRate(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external view returns (uint);
}
