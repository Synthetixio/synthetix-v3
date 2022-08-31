//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing pools and assignments per account
interface IVaultRewardsModule {
    event RewardDistributionSet(
        uint indexed poolId,
        address indexed token,
        uint indexed index,
        address distributor,
        uint totalRewarded,
        uint start,
        uint duration
    );
    event RewardsClaimed(uint indexed poolId, address indexed token, uint indexed accountId, uint index, uint amountClaimed);

    /// @notice called by pool owner or an existing distributor to set up rewards for vault participants
    function distributeRewards(
        uint poolId,
        address token,
        uint index,
        address distributor,
        uint amount,
        uint start,
        uint duration
    ) external;

    /// @notice retrieves the amount of available rewards.
    /// this function should be called to get currently available rewards using `callStatic`
    function getAvailableRewards(
        uint poolId,
        address token,
        uint accountId
    ) external returns (uint[] memory);

    /// @notice retrieves the amount of available rewards, and claims them to the caller's account.
    /// this function should be called to get currently available rewards using `callStatic`
    function claimRewards(
        uint poolId,
        address token,
        uint accountId
    ) external returns (uint[] memory);

    /// @notice returns the number of individual units of amount emitted per second per share for the given poolId, collateralType vault
    function getCurrentRewardAccumulation(uint poolId, address collateralType) external view returns (uint[] memory);
}
