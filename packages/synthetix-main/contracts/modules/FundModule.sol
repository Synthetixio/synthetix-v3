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

    function adjust(
        uint accountId,
        uint collateralType,
        uint collateralAmount,
        uint lockingPeriod,
        uint leverage
    ) public {
        // TODO require accountId can operate on collateralType

        // TODO require input data checking

        Position storage position = _fundModuleStore().positions[accountId];

        if (position.collateralAmount == 0) {
            _addPosition(accountId, collateralType, collateralAmount, lockingPeriod, leverage);
            // new position
        } else if (collateralAmount == 0) {
            _removePosition(accountId, collateralType, collateralAmount, lockingPeriod, leverage);
            // remove position
        } else if (position.collateralAmount < collateralAmount) {
            _increasePosition(accountId, collateralType, collateralAmount, lockingPeriod, leverage);
            // increase position
        } else if (position.collateralAmount > collateralAmount) {
            _decreasePosition(accountId, collateralType, collateralAmount, lockingPeriod, leverage);
            // decrease position
        } else {
            // no change
        }
    }

    function _addPosition(
        uint accountId,
        uint collateralType,
        uint collateralAmount,
        uint lockingPeriod,
        uint leverage
    ) internal {}

    function _removePosition(
        uint accountId,
        uint collateralType,
        uint collateralAmount,
        uint lockingPeriod,
        uint leverage
    ) internal {}

    function _increasePosition(
        uint accountId,
        uint collateralType,
        uint collateralAmount,
        uint lockingPeriod,
        uint leverage
    ) internal {}

    function _decreasePosition(
        uint accountId,
        uint collateralType,
        uint collateralAmount,
        uint lockingPeriod,
        uint leverage
    ) internal {}

    // TODO Check ERC4626 logic. a lot of the stuff is there

    function getAccountCurrentDebt(uint accountId) public returns (uint) {
        return 0;
    }

    function accountShares(uint accountId) public returns (uint) {
        return 0;
    }

    function totalShares() public returns (uint) {
        return 0;
    }

    function totalDebt() public returns (uint) {
        return 0;
    }

    function accountDebt(uint accountId) public returns (uint) {
        Position storage position = _fundModuleStore().positions[accountId];

        return
            accountCollateralValue(accountId) +
            position.initialDebt -
            totalDebt() *
            (accountShares(accountId) / totalShares());
    }

    function accountCollateralValue(uint accountId) public view returns (uint) {
        return 0;
        // TODO return positions[accountId].amount - positions[accountId].amount * token(accountEntry.collateralToken).value;
    }

    function getCRation(uint accountId) public returns (uint) {
        return accountCollateralValue(accountId) / accountDebt(accountId);
    }

    function _setMarkets(uint[] calldata marketIds, uint[] calldata weights) internal {}

    function _assignCollateralToMarket() internal {}
}
