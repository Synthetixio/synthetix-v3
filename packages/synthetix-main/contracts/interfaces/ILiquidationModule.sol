//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Module for liquidated positions and vaults that are below the liquidation ratio.
 */
interface ILiquidationModule {
    struct LiquidationData {
        uint debtLiquidated;
        uint collateralLiquidated;
        uint amountRewarded;
    }

    event Liquidation(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address indexed collateralType,
        LiquidationData liquidationData,
        uint128 liquidateAsAccountId,
        address sender
    );

    event VaultLiquidation(
        uint128 indexed poolId,
        address indexed collateralType,
        LiquidationData liquidationData,
        uint128 liquidateAsAccountId,
        address sender
    );

    /**
     * @notice Liquidates a position by distributing its debt and collateral among other positions in its vault.
     */
    function liquidate(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint128 liquidateAsAccountId
    ) external returns (LiquidationData memory);

    /**
     * @notice Liquidates an entire vault.
     * @dev Can only be done if the vault itself is under collateralized.
     * @dev LiquidateAsAccountId determines which account to deposit the seized collateral into (this is necessary particularly if the collateral in the vault is vesting).
     * @dev Will only liquidate a portion of the debt for the vault if `maxUsd` is supplied.
     */
    function liquidateVault(
        uint128 poolId,
        address collateralType,
        uint128 liquidateAsAccountId,
        uint maxUsd
    ) external returns (LiquidationData memory liquidationData);

    /**
     * @notice Determines whether a specified position is liquidatable.
     */
    function isPositionLiquidatable(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external returns (bool);

    /**
     * @notice Determines whether a specified vault is liquidatable.
     */
    function isVaultLiquidatable(uint128 poolId, address collateralType) external returns (bool);
}
