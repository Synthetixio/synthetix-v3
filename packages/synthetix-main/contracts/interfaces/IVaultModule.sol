//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/FundVaultStorage.sol";

/// @title Module for managing funds and assignments per account
interface IVaultModule {
    // /// @notice external access to rebalanceMarkets
    // function rebalanceMarkets(uint fundId) external; // TODO Maybe is internal

    /// @notice delegates (creates, adjust or remove a delegation) collateral from an account
    function delegateCollateral(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount,
        uint leverage
    ) external;

    /// @notice mints USD for a fund/account from a collateralType. if CRatio is valid
    function mintUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external;

    /// @notice burns USD for a fund/account from a collateralType
    function burnUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external;

    /// @notice gets the account collateral value divided by the latest vault debt
    function accountCollateralRatio(
        uint accountId,
        uint fundId,
        address collateralType
    ) external returns (uint);

    /// @notice gets the account debt in a fund for a collateral
    function accountVaultDebt(
        uint accountId,
        uint fundId,
        address collateralType
    ) external returns (int);

    /// @notice gets the account collateral value in a fund for a collateral
    function accountVaultCollateral(
        uint accountId,
        uint fundId,
        address collateralType
    ) external view returns (uint amount, uint value, uint shares);

    /// @notice gets the total fund debt
    function vaultDebt(uint fundId, address collateralType) external returns (int);

    /// @notice gets total vault collateral and its value
    function vaultCollateral(uint fundId, address collateralType) external returns (uint amount, uint value);

    /// @notice gets the vault collateral value divided by latest vault debt
    function vaultCollateralRatio(uint fundId, address collateralType) external returns (uint);

    /// @notice gets the total fund debtShares
    function totalVaultShares(uint fundId, address collateralType) external view returns (uint);

    /// @notice gets the debt per share (USD value) for a fund
    function debtPerShare(uint fundId, address collateralType) external returns (int);

    /// @notice gets liquidityItem details for a liquidityItemId
    function getLiquidityItem(bytes32 liquidityItemId) external view returns (FundVaultStorage.LiquidityItem memory liquidityItem);
}
