//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Liquidation module
 */
interface ILiquidationModule {
    /**
     * @notice Thrown when attempting to liquidate an account not elegible for liquidation
     */
    error NotEligibleForLiquidation(uint128 accountId);

    /**
     * @notice Thrown when attempting to liquidate an account's margin when not elegible for liquidation
     */
    error NotEligibleForMarginLiquidation(uint128 accountId);

    /**
     * @notice Thrown when attempting to liquidate an account's margin when it has open positions (should use normal liquidate)
     */
    error AccountHasOpenPositions(uint128 accountId);

    /**
     * @notice Gets fired when an account position is liquidated .
     * @param marketId Id of the position's market.
     * @param accountId Id of the account liquidated.
     * @param amountLiquidated amount liquidated.
     * @param currentPositionSize position size after liquidation.
     */
    event PositionLiquidated(
        uint128 indexed accountId,
        uint128 indexed marketId,
        uint256 amountLiquidated,
        int128 currentPositionSize
    );

    /**
     * @notice Gets fired when an account is flagged for liquidation.
     * @param accountId Id of the account flagged.
     * @param availableMargin available margin after flagging.
     * @param requiredMaintenanceMargin required maintenance margin which caused the flagging.
     * @param liquidationReward reward for fully liquidating account paid when liquidation occurs.
     * @param flagReward reward to keeper for flagging the account
     */
    event AccountFlaggedForLiquidation(
        uint128 indexed accountId,
        int256 availableMargin,
        uint256 requiredMaintenanceMargin,
        uint256 liquidationReward,
        uint256 flagReward
    );

    /**
     * @notice Gets fired when an account is liquidated.
     * @dev this event is fired once per liquidation tx after the each position that can be liquidated at the time was liquidated.
     * @param accountId Id of the account liquidated.
     * @param reward total reward sent to liquidator.
     * @param fullLiquidation flag indicating if it was a partial or full liquidation.
     */
    event AccountLiquidationAttempt(
        uint128 indexed accountId,
        uint256 reward,
        bool fullLiquidation
    );

    /**
     * @notice Liquidates an account.
     * @dev according to the current situation and account size it can be a partial or full liquidation.
     * @param accountId Id of the account to liquidate.
     * @return liquidationReward total reward sent to liquidator.
     */
    function liquidate(uint128 accountId) external returns (uint256 liquidationReward);

    /**
     * @notice Liquidates an account's margin when no other positions exist.
     * @dev if available margin is negative and no positions exist, then account margin can be liquidated by calling this function
     * @param accountId Id of the account to liquidate.
     * @return liquidationReward total reward sent to liquidator.
     */
    function liquidateMarginOnly(uint128 accountId) external returns (uint256 liquidationReward);

    /**
     * @notice Liquidates up to maxNumberOfAccounts flagged accounts.
     * @param maxNumberOfAccounts max number of accounts to liquidate.
     * @return liquidationReward total reward sent to liquidator.
     */
    function liquidateFlagged(
        uint256 maxNumberOfAccounts
    ) external returns (uint256 liquidationReward);

    /**
     * @notice Liquidates the listed flagged accounts.
     * @dev if any of the accounts is not flagged for liquidation it will be skipped.
     * @param accountIds list of account ids to liquidate.
     * @return liquidationReward total reward sent to liquidator.
     */
    function liquidateFlaggedAccounts(
        uint128[] calldata accountIds
    ) external returns (uint256 liquidationReward);

    /**
     * @notice Returns the list of flagged accounts.
     * @return accountIds list of flagged accounts.
     */
    function flaggedAccounts() external view returns (uint256[] memory accountIds);

    /**
     * @notice Returns if an account is eligible for liquidation.
     * @return isEligible
     */
    function canLiquidate(uint128 accountId) external view returns (bool isEligible);

    /**
     * @notice Returns if an account's margin is eligible for liquidation.
     * @return isEligible
     */
    function canLiquidateMarginOnly(uint128 accountId) external view returns (bool isEligible);

    /**
     * @notice Current liquidation capacity for the market
     * @return capacity market can liquidate up to this #
     * @return maxLiquidationInWindow max amount allowed to liquidate based on the current market configuration
     * @return latestLiquidationTimestamp timestamp of the last liquidation of the market
     */
    function liquidationCapacity(
        uint128 marketId
    )
        external
        view
        returns (
            uint256 capacity,
            uint256 maxLiquidationInWindow,
            uint256 latestLiquidationTimestamp
        );
}
