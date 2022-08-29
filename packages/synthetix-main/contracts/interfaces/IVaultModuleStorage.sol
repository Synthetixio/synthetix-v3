//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Vault Liquidity Item type declarations used by different contracts
interface IVaultModuleStorage {
    /// @notice LiquidityItem struct definition. Account/CollateralType/PoolId uniquiely identifies it
    struct LiquidityItem {
        uint256 accountId;
        address collateralType;
        uint256 poolId;
        uint256 collateralAmount;
        uint256 shares;
        uint256 initialDebt; // how that works with amount adjustments?
        uint256 leverage;
    }
}
