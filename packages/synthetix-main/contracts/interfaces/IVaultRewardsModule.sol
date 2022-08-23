//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing funds and assignments per account
interface IVaultRewardsModule {
    /// @notice called by fund owner or an existing distributor to set up rewards for vault participants
    function distributeRewards(
        uint fundId,
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
        uint fundId,
        address token,
        uint accountId
    ) external returns (uint[] memory);

    /// @notice retrieves the amount of available rewards, and claims them to the caller's account.
    /// this function should be called to get currently available rewards using `callStatic`
    function claimRewards(
        uint fundId,
        address token,
        uint accountId
    ) external returns (uint[] memory);

    /// @notice returns the number of individual units of amount emitted per second per share for the given fundId, collateralType vault
    function getCurrentRewardAccumulation(
        uint fundId,
        address collateralType
    ) external view returns (uint[] memory);
}
