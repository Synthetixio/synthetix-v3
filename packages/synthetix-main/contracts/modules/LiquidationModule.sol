//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
// import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
// import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

import "../interfaces/ILiquidationModule.sol";
import "../storage/FundModuleStorage.sol";

import "../mixins/CollateralMixin.sol";
import "../mixins/FundMixin.sol";

contract LiquidationsModule is ILiquidationModule, CollateralMixin, FundMixin {
    function liquidate(
        uint accountId,
        uint fundId,
        address collateralType
    ) external override {
        require(_isLiquidatable(accountId, fundId, collateralType), "Cannot liquidate");
        (uint accountDebt, uint collateral) = _accountDebtAndCollateral(fundId, accountId, collateralType);

        // _deleteLiquidityItem
        // reallocate collateral
    }

    function _isLiquidatable(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal returns (bool) {
        return _collateralizationRatio(accountId, fundId, collateralType) < _getCollateralMinimumCRatio(collateralType);
    }

    function isLiquidatable(
        uint accountId,
        uint fundId,
        address collateralType
    ) external override returns (bool) {
        return _isLiquidatable(accountId, fundId, collateralType);
    }

    /*
    function liquidateVault() {
        // 'classic' style liquidation for entire value, partial liquidation allow
    }
    */

    // move below to liqudations storage

    // NOTE FOR DB: At the point when the liqudiation occurs, can we look at the current value of the curve to alter the linear entry to 'smooth' it?

    function _vestedRewards(uint accountId, LiqudationInformation storage liquidationsCurve) internal view returns (uint) {
        return
            ((liquidationsCurve.accumulated - liquidationsCurve.initialAmount[accountId]) *
                CurvesLibrary.calculateValueAtCurvePoint(liquidationsCurve.curve, block.timestamp)) /
            CurvesLibrary.calculateValueAtCurvePoint(liquidationsCurve.curve, liquidationsCurve.curve.end);
    }

    // mapping vault (fundId + collateralType) as keccak -> liqudation curve
    mapping(bytes32 => CurvesLibrary.PolynomialCurve) _liquidationCurves;
}
