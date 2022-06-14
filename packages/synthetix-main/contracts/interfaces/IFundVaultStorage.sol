//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFundVaultStorage {
    struct LiquidityItem {
        uint256 accountId;
        address collateralType;
        uint256 fundId;
        uint256 collateralAmount;
        uint256 shares;
        uint256 initialDebt; // how that works with amount adjustments?
        uint256 leverage;
    }
}
