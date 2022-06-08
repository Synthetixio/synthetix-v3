//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFundModuleStorage {
    struct LiquidityItem {
        address collateralType;
        uint256 fundId;
        uint256 accountId;
        uint256 leverage;
        uint256 collateralAmount;
        uint256 shares;
        uint256 initialDebt; // how that works with amount adjustments?
    }
}
