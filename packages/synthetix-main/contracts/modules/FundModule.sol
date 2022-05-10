//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../interfaces/IFundModule.sol";
import "../storage/FundModuleStorage.sol";

contract FundModule is IFundModule, OwnableMixin, FundModuleStorage, InitializableMixin {
    event FundCreated(address fundAddress);

    function _isInitialized() internal view override returns (bool) {
        return _fundModuleStore().initialized;
    }

    function isFundModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeFundModule() external override onlyOwner onlyIfNotInitialized {
        FundModuleStore storage store = _fundModuleStore();

        store.initialized = true;
    }

    //////////////////////////////////////////////
    //          BUSINESS LOGIC                  //
    //////////////////////////////////////////////

    // function adjust(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint collateralAmount,
    //     uint lockingPeriod,
    //     uint leverage
    // ) public override {
    //     // TODO require accountId can operate on collateralType

    //     // TODO require input data checking

    //     bytes32 lpid = _calculateLPId(fundId, accountId, collateralType, leverage);
    //     LiquidityProvider storage position = _fundModuleStore().liquidityProviders[lpid];

    //     if (position.collateralAmount == 0) {
    //         _addPosition(fundId, accountId, collateralType, collateralAmount, lockingPeriod, leverage);
    //         // new position
    //     } else if (collateralAmount == 0) {
    //         _removePosition(fundId, accountId, collateralType, collateralAmount, lockingPeriod, leverage);
    //         // remove position
    //     } else if (position.collateralAmount < collateralAmount) {
    //         _increasePosition(fundId, accountId, collateralType, collateralAmount, lockingPeriod, leverage);
    //         // increase position
    //     } else if (position.collateralAmount > collateralAmount) {
    //         _decreasePosition(fundId, accountId, collateralType, collateralAmount, lockingPeriod, leverage);
    //         // decrease position
    //     } else {
    //         // no change
    //     }
    // }

    // function _addPosition(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint collateralAmount,
    //     uint lockingPeriod,
    //     uint leverage
    // ) internal {}

    // function _removePosition(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint collateralAmount,
    //     uint lockingPeriod,
    //     uint leverage
    // ) internal {}

    // function _increasePosition(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint collateralAmount,
    //     uint lockingPeriod,
    //     uint leverage
    // ) internal {}

    // function _decreasePosition(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint collateralAmount,
    //     uint lockingPeriod,
    //     uint leverage
    // ) internal {}

    // TODO Check ERC4626 logic. a lot of the stuff is there

    // function getAccountCurrentDebt(uint accountId) public override returns (uint) {
    //     return 0;
    // }

    // function accountShares(uint accountId) public override returns (uint) {
    //     return 0;
    // }

    // function totalShares() public override returns (uint) {
    //     return 0;
    // }

    // function totalDebt() public override returns (uint) {
    //     return 0;
    // }

    // function accountDebt(uint fundId, uint accountId) public override returns (uint) {
    //     // bytes32 lpid = _calculateLPId(fundId, accountId, collateralType, leverage);
    //     // LiquidityProvider storage position = _fundModuleStore().liquidityProviders[lpid];
    //     bytes32[] storage liquidityProviderIds = _fundModuleStore().liquidityProviderIds[fundId];
    //     for (uint i = 0; i < liquidityProviderIds.length; i++) {
    //         LiquidityProvider storage lp = _fundModuleStore().liquidityProviders[liquidityProviderIds[i]];
    //         if (lp.accountId == accountId) {
    //             // do the math with
    //             // lp.leverage;
    //             // lp.collateralAmount;
    //             // lp.shares;
    //             // lp.initialDebt;
    //         }
    //     }

    //     return 0;
    //     // accountCollateralValue(accountId) +
    //     // position.initialDebt -
    //     // totalDebt() *
    //     // (accountShares(accountId) / totalShares());
    // }

    // function accountCollateralValue(uint accountId) public view override returns (uint) {
    //     return 0;
    //     // TODO return positions[accountId].amount - positions[accountId].amount * token(accountEntry.collateralToken).value;
    // }

    // function getCRation(uint fundId, uint accountId) public override returns (uint) {
    //     return accountCollateralValue(accountId) / accountDebt(fundId, accountId);
    // }

    // function _setMarkets(uint[] calldata marketIds, uint[] calldata weights) internal {}

    // function _assignCollateralToMarket() internal {}

    /////////////////////////////////////////////////
    // INTERNALS
    /////////////////////////////////////////////////

    // function _calculateLPId(
    //     uint fundId,
    //     uint accountId,
    //     address collateralType,
    //     uint leverage
    // ) internal view returns (bytes32) {
    //     return keccak256(abi.encodePacked(fundId, accountId, collateralType, leverage));
    // }
}
