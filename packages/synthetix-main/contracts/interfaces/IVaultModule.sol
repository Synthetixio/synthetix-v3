//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/PoolVaultStorage.sol";

/// @title Module for managing pools and assignments per account
interface IVaultModule {
    // /// @notice external access to rebalanceMarkets
    // function rebalanceMarkets(uint poolId) external; // TODO Maybe is internal

    /// @notice delegates (creates, adjust or remove a delegation) collateral from an account
    function delegateCollateral(
        uint accountId,
        uint poolId,
        address collateralType,
        uint amount,
        uint leverage
    ) external;

    /// @notice mints USD for a pool/account from a collateralType. if CRatio is valid
    function mintUSD(
        uint accountId,
        uint poolId,
        address collateralType,
        uint amount
    ) external;

    /// @notice burns USD for a pool/account from a collateralType
    function burnUSD(
        uint accountId,
        uint poolId,
        address collateralType,
        uint amount
    ) external;

    /// @notice gets the account collateral value divided by the latest vault debt
    function accountCollateralRatio(
        uint accountId,
        uint poolId,
        address collateralType
    ) external returns (uint);

    /// @notice gets the account debt in a pool for a collateral
    function accountVaultDebt(
        uint accountId,
        uint poolId,
        address collateralType
    ) external returns (int);

    /// @notice gets the account collateral value in a pool for a collateral
    function accountVaultCollateral(
        uint accountId,
        uint poolId,
        address collateralType
    )
        external
        view
        returns (
            uint amount,
            uint value,
            uint shares
        );

    /// @notice gets the total pool debt
    function vaultDebt(uint poolId, address collateralType) external returns (int);

    /// @notice gets total vault collateral and its value
    function vaultCollateral(uint poolId, address collateralType) external returns (uint amount, uint value);

    /// @notice gets the vault collateral value divided by latest vault debt
    function vaultCollateralRatio(uint poolId, address collateralType) external returns (uint);

    /// @notice gets the total pool debtShares
    function totalVaultShares(uint poolId, address collateralType) external view returns (uint);
}
