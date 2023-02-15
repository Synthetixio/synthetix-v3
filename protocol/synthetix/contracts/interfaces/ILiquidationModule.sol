//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module for liquidated positions and vaults that are below the liquidation ratio.
 */
interface ILiquidationModule {
    /**
     * @notice Thrown when attempting to liquidate an account that is not eligible for liquidation.
     */
    error IneligibleForLiquidation(
        uint256 collateralValue,
        int256 debt,
        uint256 currentCRatio,
        uint256 cratio
    );

    /**
     * @notice Thrown when an entire vault instead of a single account should be liquidated.
     */
    error MustBeVaultLiquidated();

    /**
     * @notice Emitted when an account is liquidated.
     * @param accountId The id of the account that was liquidated.
     * @param poolId The pool id of the position that was liquidated.
     * @param collateralType The collateral type used in the position that was liquidated.
     * @param liquidationData The amount of collateral liquidated, debt liquidated, and collateral awarded to the liquidator.
     * @param liquidateAsAccountId Account id that will receive the rewards from the liquidation.
     * @param sender The address of the account that is triggering the liquidation.
     */
    event Liquidation(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address indexed collateralType,
        LiquidationData liquidationData,
        uint128 liquidateAsAccountId,
        address sender
    );

    /**
     * @notice Emitted when a vault is liquidated.
     * @param poolId The id of the pool whose vault was liquidated.
     * @param collateralType The collateral address of the vault that was liquidated.
     * @param liquidationData The amount of collateral liquidated, debt liquidated, and collateral awarded to the liquidator.
     * @param liquidateAsAccountId Account id that will receive the rewards from the liquidation.
     * @param sender The address of the account that is triggering the liquidation.
     */
    event VaultLiquidation(
        uint128 indexed poolId,
        address indexed collateralType,
        LiquidationData liquidationData,
        uint128 liquidateAsAccountId,
        address sender
    );

    /**
     * @notice Data structure that holds liquidation information, used in events and in return statements.
     */
    struct LiquidationData {
        /**
         * @dev The debt of the position that was liquidated.
         */
        uint256 debtLiquidated;
        /**
         * @dev The collateral of the position that was liquidated.
         */
        uint256 collateralLiquidated;
        /**
         * @dev The amount rewarded in the liquidation.
         */
        uint256 amountRewarded;
    }

    /**
     * @notice Liquidates a position by distributing its debt and collateral among other positions in its vault.
     * @param accountId The id of the account whose position is to be liquidated.
     * @param poolId The id of the pool which holds the position that is to be liquidated.
     * @param collateralType The address of the collateral being used in the position that is to be liquidated.
     * @param liquidateAsAccountId Account id that will receive the rewards from the liquidation.
     * @return liquidationData Information about the position that was liquidated.
     */
    function liquidate(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint128 liquidateAsAccountId
    ) external returns (LiquidationData memory liquidationData);

    /**
     * @notice Liquidates an entire vault.
     * @dev Can only be done if the vault itself is under collateralized.
     * @dev LiquidateAsAccountId determines which account to deposit the seized collateral into (this is necessary particularly if the collateral in the vault is vesting).
     * @dev Will only liquidate a portion of the debt for the vault if `maxUsd` is supplied.
     * @param poolId The id of the pool whose vault is being liquidated.
     * @param collateralType The address of the collateral whose vault is being liquidated.
     * @param maxUsd The maximum amount of USD that the liquidator is willing to provide for the liquidation, denominated with 18 decimals of precision.
     * @return liquidationData Information about the vault that was liquidated.
     */
    function liquidateVault(
        uint128 poolId,
        address collateralType,
        uint128 liquidateAsAccountId,
        uint256 maxUsd
    ) external returns (LiquidationData memory liquidationData);

    /**
     * @notice Determines whether a specified position is liquidatable.
     * @param accountId The id of the account whose position is being queried for liquidation.
     * @param poolId The id of the pool whose position is being queried for liquidation.
     * @param collateralType The address of the collateral backing up the position being queried for liquidation.
     * @return canLiquidate A boolean with the response to the query.
     */
    function isPositionLiquidatable(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external returns (bool canLiquidate);

    /**
     * @notice Determines whether a specified vault is liquidatable.
     * @param poolId The id of the pool that owns the vault that is being queried for liquidation.
     * @param collateralType The address of the collateral being held at the vault that is being queried for liquidation.
     * @return canVaultLiquidate A boolean with the response to the query.
     */
    function isVaultLiquidatable(
        uint128 poolId,
        address collateralType
    ) external returns (bool canVaultLiquidate);
}
