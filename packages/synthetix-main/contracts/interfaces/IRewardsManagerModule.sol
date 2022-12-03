//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Module for connecting rewards distributors to vaults.
 */
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

    /**
     * @notice Called by pool owner or an existing distributor to register rewards for vault participants.
     */
    function registerRewardsDistributor(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external;

    /**
     * @notice Called by pool owner or an existing distributor to set up rewards for vault participants.
     */
    function distributeRewards(
        uint128 poolId,
        address collateralType,
        uint amount,
        uint64 start,
        uint32 duration
    ) external;

    /**
     * @notice Allows a user with appropriate permissions to claim rewards associated with a position.
     */
    function claimRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        address distributor
    ) external returns (uint);

    /**
     * @notice For a given position, return the rewards that can currently be claimed
     */
    function getClaimableRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId
    ) external returns (uint[] memory, address[] memory);

    /**
     * @notice Returns the number of individual units of amount emitted per second per share for the given poolId, collateralType, distributor vault.
     */
    function getRewardRate(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external view returns (uint);
}
