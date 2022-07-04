//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../mixins/CurvesLibrary.sol";

/// @title Module for managing fund token and funds positions distribution
interface ILiquidationModule {
    struct LiqudationInformation {
        CurvesLibrary.PolynomialCurve curve;
        mapping(uint => uint) initialAmount; // key is accountId, amount is accumulated when you entered the vault
        uint accumulated; // how much accumulation per debt share (updated before anyone enters/leaves the vaults)
    }

    function liquidate(
        uint accountId,
        uint fundId,
        address collateralType
    ) external;

    function isLiquidatable(
        uint accountId,
        uint fundId,
        address collateralType
    ) external returns (bool);
}
