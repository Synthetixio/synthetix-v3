//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IVaultModuleStorage.sol";

/// @title Module for managing funds and assignments per account
interface IVaultModule is IVaultModuleStorage {
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

    /// @notice gets the CRatio for an account/collateral in a fund
    function collateralizationRatio(
        uint accountId,
        uint fundId,
        address collateralType
    ) external view returns (uint);

    /// @notice gets the account debt in a fund for a collateral
    function accountFundDebt(
        uint accountId,
        uint fundId,
        address collateralType
    ) external view returns (uint);

    /// @notice gets the account collateral value in a fund for a collateral
    function accountFundCollateralValue(
        uint accountId,
        uint fundId,
        address collateralType
    ) external view returns (uint);

    /// @notice gets the total fund debt
    function fundDebt(uint fundId, address collateralType) external view returns (uint);

    /// @notice gets the total fund debtShares
    function totalDebtShares(uint fundId, address collateralType) external view returns (uint);

    /// @notice gets the debt per share (USD value) for a fund
    function debtPerShare(uint fundId, address collateralType) external view returns (uint);

    /// @notice gets liquidityItem details for a liquidityItemId
    function getLiquidityItem(bytes32 liquidityItemId) external view returns (LiquidityItem memory liquidityItem);

    /// @notice gets list of liquidityItemIds for an accountId
    function getAccountLiquidityItemIds(uint accountId) external view returns (bytes32[] memory liquidityItemIds);

    /// @notice gets list of liquidityItem details for an accountId
    function getAccountLiquidityItems(uint accountId) external view returns (LiquidityItem[] memory liquidityItems);
}
