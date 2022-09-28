//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/CollateralConfiguration.sol";

/// @title Module for managing collateral
interface ICollateralModule {
    /**
     * @notice Emitted when a collateral type’s configuration is created or updated.
     */
    event CollateralConfigured(
        address indexed collateralType,
        address indexed priceFeed,
        uint targetCollateralizationRatio,
        uint minimumCollateralizationRatio,
        uint liquidationReward,
        bool indexed stakingEnabled
    );

    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is deposited to account `accountId` by `sender`.
     */
    event CollateralDeposited(
        uint128 indexed accountId,
        address indexed collateralType,
        uint amount,
        address indexed sender
    );

    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is withdrawn from account `accountId` by `sender`.
     */
    event CollateralWithdrawn(
        uint128 indexed accountId,
        address indexed collateralType,
        uint amount,
        address indexed sender
    );

    /**
     * @notice Creates or updates the configuration for given `collateralType`.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the system.
     *
     * Emits a {CollateralConfigured} event.
     *
     */
    function configureCollateral(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        uint liquidationReward,
        bool stakingEnabled
    ) external;

    /**
     * @notice Returns a list of detailed information pertaining to all collateral types registered in the system.
     */
    function getCollateralConfigurations(bool hideDisabled)
        external
        view
        returns (CollateralConfiguration.Data[] memory collaterals);

    /**
     * @notice Returns detailed information pertaining the specified collateral type.
     */
    function getCollateralConfiguration(address collateralType)
        external
        view
        returns (CollateralConfiguration.Data memory collateral);

    /**
     * @notice Returns the current value of a specified collateral type
     */
    function getCollateralValue(address collateralType) external view returns (uint);

    /**
     * @notice Deposits `amount` of collateral of type `collateralType` into account `accountId`.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `DEPOSIT` permission.
     *
     * Emits a {CollateralDeposited} event.
     *
     */
    function depositCollateral(
        uint128 accountId,
        address collateralType,
        uint amount
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
    function withdrawCollateral(
        uint128 accountId,
        address collateralType,
        uint amount
    ) external;

    /// @notice Returns the total values pertaining to account `accountId` for `collateralType`.
    function getAccountCollateral(uint128 accountId, address collateralType)
        external
        view
        returns (
            uint totalDeposited,
            uint totalAssigned
            //uint totalLocked,
            //uint totalEscrowed
        );

    /// @notice Returns the amount of collateral of type `collateralType` deposited with account `accountId` that can be withdrawn or delegated.
    function getAccountAvailableCollateral(uint128 accountId, address collateralType) external view returns (uint);

    /*
    /// @notice Returns the amount of collateral of type `collateralType` staked with account `accountId` that can be unstaked.
    /// @dev DEPENDENT ON 305 (Would be combined with `getAccountUnstakebleCollateral` into `getAccountAvailableCollateral`)
    function getAccountUnstakebleCollateral(uint128 accountId, address collateralType) external view returns (uint);

    /// @notice Returns the amount of collateral of type `collateralType` staked with account `accountId` that can be delegated to a pool.
    /// @dev DEPENDENT ON 305 (Would be combined with `getAccountUnstakebleCollateral` into `getAccountAvailableCollateral`)
    function getAccountUnassignedCollateral(uint128 accountId, address collateralType) external view returns (uint);

    /// @notice Clean expired locks from locked collateral arrays for an account/collateral type. It includes offset and items to prevent gas exhaustion. If both, offset and items, are 0 it will traverse the whole array (unlimited)
    /// @dev DEPENDENT ON 305
    function cleanExpiredLocks(
        uint128 accountId,
        address collateralType,
        uint offset,
        uint items
    ) external;

    /// @notice Redeems the system escrow tokens into reward tokens
    /// @dev DEPENDENT ON 305
    function redeemReward(
        uint128 accountId,
        uint amount,
        uint duration
    ) external;
*/
}
