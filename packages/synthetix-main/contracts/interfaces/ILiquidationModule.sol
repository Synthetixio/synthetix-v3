//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Liquidates the collateral for an account in a pool
interface ILiquidationModule {
    event Liquidation(
        uint128 indexed accountId,
        uint128 indexed poolId,
        address indexed collateralType,
        uint debtLiquidated,
        uint collateralLiquidated,
        uint amountRewarded,
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

    struct LiquidationInformation {
        mapping(uint => uint) initialAmount; // key is accountId, amount is accumulated when you entered the vault
        uint accumulated; // how much accumulation per debt share (updated before anyone enters/leaves the vaults)
    }

    /// @notice liquidates the required collateral of the account delegated to the poolId
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

    /// @notice liquidates an entire vault. can only be done if the vault itself is undercollateralized.
    /// liquidateAsAccountId determines which account to deposit the siezed collateral into (this is necessary particularly if the collateral in the vault is vesting)
    /// Will only liquidate a portion of the debt for the vault if `maxUsd` is supplied
    function liquidateVault(
        uint128 poolId,
        address collateralType,
        uint128 liquidateAsAccountId,
        uint maxUsd
    ) external returns (uint amountRewarded, uint collateralLiquidated);

    /// @notice returns if the account is liquidable on the poolId - collateralType pair
    function isLiquidatable(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external returns (bool);
}
