//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Liquidates the collateral for an account in a pool
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
        uint liquidateAsAccountId,
        address sender
    );

    event VaultLiquidation(
        uint128 indexed poolId,
        address indexed collateralType,
        uint debtLiquidated,
        uint collateralLiquidated,
        uint liquidateAsAccountId,
        address sender
    );

    /// @notice liquidates the required collateral of the account delegated to the poolId
    function liquidate(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint128 liquidateAsAccountId
    ) external returns (LiquidationData memory);

    /// @notice liquidates an entire vault. can only be done if the vault itself is undercollateralized.
    /// liquidateAsAccountId determines which account to deposit the siezed collateral into (this is necessary particularly if the collateral in the vault is vesting)
    /// Will only liquidate a portion of the debt for the vault if `maxUsd` is supplied
    function liquidateVault(
        uint128 poolId,
        address collateralType,
        uint128 liquidateAsAccountId,
        uint maxUsd
    ) external returns (uint amountRewarded, uint collateralLiquidated);

    function isPositionLiquidatable(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external returns (bool);

    function isVaultLiquidatable(uint128 poolId, address collateralType) external returns (bool);
}
