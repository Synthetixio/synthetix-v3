//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/CollateralStorage.sol";

/// @title Module for managing collateral
interface ICollateralModule {
    /**
     * @notice Emitted when a collateral type’s configuration is created or updated.
     */
    event CollateralConfigured(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        bool enabled
    );

    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is staked to account `accountId` by `sender`.
     */
    event CollateralStaked(uint accountId, address collateralType, uint amount, address sender);

    /**
     * @notice Emitted when `amount` of collateral of type `collateralType` is unstaked from account `accountId` by `sender`.
     */
    event CollateralUnstaked(uint accountId, address collateralType, uint amount, address sender);

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
    function adjustCollateralType(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        bool enabled
    ) external;

    /**
     * @notice Returns a list of detailed information pertaining to all collateral types registered in the system.
     */
    function getCollateralTypes(bool hideDisabled)
        external
        view
        returns (CollateralStorage.CollateralData[] memory collaterals);

    /**
     * @notice Returns detailed information pertaining the specified collateral type.
     */
    function getCollateralType(address collateralType)
        external
        view
        returns (CollateralStorage.CollateralData memory collateral);

    /**
     * @notice Stakes `amount` of collateral of type `collateralType` into account `accountId`.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `STAKE` permission.
     *
     * Emits a {CollateralStaked} event.
     *
     */
    function stake(
        uint accountId,
        address collateralType,
        uint amount
    ) external;

    /**
     * @notice Unstakes `amount` of collateral of type `collateralType` from account `accountId`.
     *
     * Requirements:
     *
     * - `msg.sender` must be the owner of the account, have the `ADMIN` permission, or have the `UNSTAKE` permission.
     *
     * Emits a {CollateralUnstaked} event.
     *
     */
    function unstake(
        uint accountId,
        address collateralType,
        uint amount
    ) external;

    /// @notice Returns the total values pertaining to account `accountId` for `collateralType`.
    function getAccountCollateral(uint accountId, address collateralType)
        external
        view
        returns (
            uint totalStaked,
            uint totalAssigned
            //uint totalLocked,
            //uint totalEscrowed
        );

    /// @notice Returns the amount of collateral of type `collateralType` staked with account `accountId` that can be unstaked or delegated.
    function getAccountAvailableCollateral(uint accountId, address collateralType) external view returns (uint);

    /*
    /// @notice Returns the amount of collateral of type `collateralType` staked with account `accountId` that can be unstaked.
    /// @dev DEPENDENT ON 305 (Would be combined with `getAccountUnstakebleCollateral` into `getAccountAvailableCollateral`)
    function getAccountUnstakebleCollateral(uint accountId, address collateralType) external view returns (uint);

    /// @notice Returns the amount of collateral of type `collateralType` staked with account `accountId` that can be delegated to a pool.
    /// @dev DEPENDENT ON 305 (Would be combined with `getAccountUnstakebleCollateral` into `getAccountAvailableCollateral`)
    function getAccountUnassignedCollateral(uint accountId, address collateralType) external view returns (uint);

    /// @notice Clean expired locks from locked collateral arrays for an account/collateral type. It includes offset and items to prevent gas exhaustion. If both, offset and items, are 0 it will traverse the whole array (unlimited)
    /// @dev DEPENDENT ON 305
    function cleanExpiredLocks(
        uint accountId,
        address collateralType,
        uint offset,
        uint items
    ) external;

    /// @notice Redeems the system escrow tokens into reward tokens
    /// @dev DEPENDENT ON 305
    function redeemReward(
        uint accountId,
        uint amount,
        uint duration
    ) external;
*/
}
