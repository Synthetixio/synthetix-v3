//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for connecting rewards distributors to vaults.
 */
interface IRewardsManagerModule {
    /**
     * @notice Emitted when a reward distributor returns `false` from `payout` indicating a problem
     * preventing the payout from being executed. In this case, it is advised to check with the
     * project maintainers, and possibly try again in the future.
     * @param distributor the distributor which originated the issue
     */
    error RewardUnavailable(address distributor);

    /**
     * @notice Emitted when the pool owner or an existing reward distributor sets up rewards for vault participants.
     * @param poolId The id of the pool on which rewards were distributed.
     * @param collateralType The collateral type of the pool on which rewards were distributed.
     * @param distributor The reward distributor associated to the rewards that were distributed.
     * @param amount The amount of rewards that were distributed.
     * @param start The date one which the rewards will begin to be claimable.
     * @param duration The time in which all of the distributed rewards will be claimable.
     */
    event RewardsDistributed(
        uint128 indexed poolId,
        address indexed collateralType,
        address distributor,
        uint256 amount,
        uint256 start,
        uint256 duration
    );

    /**
     * @notice Emitted when a vault participant claims rewards.
     * @param accountId The id of the account that claimed the rewards.
     * @param poolId The id of the pool where the rewards were claimed.
     * @param collateralType The address of the collateral used in the pool's rewards.
     * @param distributor The address of the rewards distributor associated with these rewards.
     * @param amount The amount of rewards that were claimed.
     */
    event RewardsClaimed(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address indexed collateralType,
        address distributor,
        uint256 amount
    );

    /**
     * @notice Emitted when a new rewards distributor is registered.
     * @param poolId The id of the pool whose reward distributor was registered.
     * @param collateralType The address of the collateral used in the pool's rewards.
     * @param distributor The address of the newly registered reward distributor.
     */
    event RewardsDistributorRegistered(
        uint128 indexed poolId,
        address indexed collateralType,
        address indexed distributor
    );

    /**
     * @notice Emitted when an already registered rewards distributor is removed.
     * @param poolId The id of the pool whose reward distributor was registered.
     * @param collateralType The address of the collateral used in the pool's rewards.
     * @param distributor The address of the registered reward distributor.
     */
    event RewardsDistributorRemoved(
        uint128 indexed poolId,
        address indexed collateralType,
        address indexed distributor
    );

    /**
     * @notice Called by pool owner to register rewards for vault participants.
     * @param poolId The id of the pool whose rewards are to be managed by the specified distributor.
     * @param collateralType The address of the collateral used in the pool's rewards.
     * @param distributor The address of the reward distributor to be registered.
     */
    function registerRewardsDistributor(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external;

    /**
     * @notice Called by pool owner to remove a registered rewards distributor for vault participants.
     * WARNING: if you remove a rewards distributor, the same address can never be re-registered again. If you
     * simply want to turn off
     * rewards, call `distributeRewards` with 0 emission. If you need to completely reset the rewards distributor
     * again, create a new rewards distributor at a new address and register the new one.
     * This function is provided since the number of rewards distributors added to an account is finite,
     * so you can remove an unused rewards distributor if need be.
     * NOTE: unclaimed rewards can still be claimed after a rewards distributor is removed (though any
     * rewards-over-time will be halted)
     * @param poolId The id of the pool whose rewards are to be managed by the specified distributor.
     * @param collateralType The address of the collateral used in the pool's rewards.
     * @param distributor The address of the reward distributor to be registered.
     */
    function removeRewardsDistributor(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external;

    /**
     * @notice Called by a registered distributor to set up rewards for vault participants.
     * @dev Will revert if the caller is not a registered distributor.
     * @param poolId The id of the pool to distribute rewards to.
     * @param collateralType The address of the collateral used in the pool's rewards.
     * @param amount The amount of rewards to be distributed.
     * @param start The date at which the rewards will begin to be claimable.
     * @param duration The period after which all distributed rewards will be claimable.
     */
    function distributeRewards(
        uint128 poolId,
        address collateralType,
        uint256 amount,
        uint64 start,
        uint32 duration
    ) external;

    /**
     * @notice Allows a user with appropriate permissions to claim rewards associated with a position.
     * @param accountId The id of the account that is to claim the rewards.
     * @param poolId The id of the pool to claim rewards on.
     * @param collateralType The address of the collateral used in the pool's rewards.
     * @param distributor The address of the rewards distributor associated with the rewards being claimed.
     * @return amountClaimedD18 The amount of rewards that were available for the account and thus claimed.
     */
    function claimRewards(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        address distributor
    ) external returns (uint256 amountClaimedD18);

    /**
     * @notice For a given position, return the rewards that can currently be claimed.
     * @param poolId The id of the pool being queried.
     * @param collateralType The address of the collateral used in the pool's rewards.
     * @param accountId The id of the account whose available rewards are being queried.
     * @return claimableD18 An array of ids of the reward entries that are claimable by the position.
     * @return distributors An array with the addresses of the reward distributors associated with the claimable rewards.
     */
    function updateRewards(
        uint128 poolId,
        address collateralType,
        uint128 accountId
    ) external returns (uint256[] memory claimableD18, address[] memory distributors);

    /**
     * @notice Returns the number of individual units of amount emitted per second per share for the given poolId, collateralType, distributor vault.
     * @param poolId The id of the pool being queried.
     * @param collateralType The address of the collateral used in the pool's rewards.
     * @param distributor The address of the rewards distributor associated with the rewards in question.
     * @return rateD18 The queried rewards rate.
     */
    function getRewardRate(
        uint128 poolId,
        address collateralType,
        address distributor
    ) external view returns (uint256 rateD18);
}
