//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title LiquidationModule interface.
 * @notice System module for liquidated positions and vaults that are below the liquidation ratio.
 */
interface ILiquidationModule {
    event Liquidation(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address indexed collateralType,
        uint debtLiquidated,
        uint collateralLiquidated,
        uint amountRewarded
    );

    event VaultLiquidation(
        uint128 indexed poolId,
        address indexed collateralType,
        uint debtLiquidated,
        uint collateralLiquidated,
        uint liquidateAsAccountId,
        address sender
    );

    struct LiquidationInformation {
        mapping(uint => uint) initialAmount; // key is accountId, amount is accumulated when you entered the vault
        uint accumulated; // how much accumulation per debt share (updated before anyone enters/leaves the vaults)
    }

    /**
     * @notice Liquidates a position by distributing its debt and collateral among other positions in its vault.
     */
    function liquidate(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint128 liquidateAsAccountId
    )
        external
        returns (
            uint amountRewarded,
            uint debtLiquidated,
            uint collateralLiquidated
        );

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
    ) external returns (uint amountRewarded, uint collateralLiquidated);

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
