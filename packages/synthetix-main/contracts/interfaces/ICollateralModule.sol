//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/CollateralConfiguration.sol";

/// @title Module for managing user collateral
interface ICollateralModule {
    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is deposited to account `accountId` by `sender`.
     */
    event Deposited(uint128 indexed accountId, address indexed collateralType, uint tokenAmount, address indexed sender);

    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is withdrawn from account `accountId` by `sender`.
     */
    event Withdrawn(uint128 indexed accountId, address indexed collateralType, uint tokenAmount, address indexed sender);

    /**
     * @notice Deposits `amount` of collateral of type `collateralType` into account `accountId`.
     * Anyone can deposit into anyone's active account without restriction.
     *
     * Emits a {CollateralDeposited} event.
     *
     */
    function deposit(
        uint128 accountId,
        address collateralType,
        uint tokenAmount
    ) external;

    /**
     * @notice Withdraws `amount` of collateral of type `collateralType` from account `accountId`.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `WITHDRAW` permission.
     *
     * Emits a {CollateralWithdrawn} event.
     *
     */
    function withdraw(
        uint128 accountId,
        address collateralType,
        uint tokenAmount
    ) external;

    /// @notice Returns the total values pertaining to account `accountId` for `collateralType`.
    function getAccountCollateral(uint128 accountId, address collateralType)
        external
        view
        returns (
            uint totalDeposited,
            uint totalAssigned,
            uint totalLocked
            //uint totalEscrowed
        );

    /// @notice Returns the amount of collateral of type `collateralType` deposited with account `accountId` that can be withdrawn or delegated.
    function getAccountAvailableCollateral(uint128 accountId, address collateralType) external view returns (uint);

    /// @notice Clean expired locks from locked collateral arrays for an account/collateral type. It includes offset and items to prevent gas exhaustion. If both, offset and items, are 0 it will traverse the whole array (unlimited)
    /// @dev DEPENDENT ON 305
    function cleanExpiredLocks(
        uint128 accountId,
        address collateralType,
        uint offset,
        uint items
    ) external;

    /// @notice Create a new lock on the given account. you must have `admin` permission on the specified account to create a lock.
    /// There is currently no benefit to calling this function. it is simply for allowing pre-created accounts to have locks on them if your protocol requires it.
    function createLock(
        uint128 accountId,
        address collateralType,
        uint amount,
        uint64 expireTimestamp
    ) external;

    function configureOracleManager(address oracleManagerAddress) external;
}
