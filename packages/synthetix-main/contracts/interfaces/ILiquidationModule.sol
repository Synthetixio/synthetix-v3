//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/CurvesLibrary.sol";

/// @title Liquidates the collateral for an account in a fund
interface ILiquidationModule {
    struct LiqudationInformation {
        CurvesLibrary.PolynomialCurve curve;
        mapping(uint => uint) initialAmount; // key is accountId, amount is accumulated when you entered the vault
        uint accumulated; // how much accumulation per debt share (updated before anyone enters/leaves the vaults)
    }

    /// @notice liquidates the required collateral of the account delegated to the fundId
    function liquidate(
        uint accountId,
        uint fundId,
        address collateralType
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
        uint fundId,
        address collateralType,
        uint liquidateAsAccountId,
        uint maxUsd
    ) external returns (uint amountRewarded, uint collateralLiquidated);

    /// @notice returns if the account is liquidable on the fundId - collateralType pair
    function isLiquidatable(
        uint accountId,
        uint fundId,
        address collateralType
    ) external returns (bool);
}
