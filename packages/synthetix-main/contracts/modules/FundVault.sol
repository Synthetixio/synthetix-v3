//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "../mixins/AccountRBACMixin.sol";
import "../mixins/CollateralMixin.sol";
import "../mixins/FundMixin.sol";
import "../mixins/SUSDMixin.sol";

import "../storage/FundVaultStorage.sol";
import "../interfaces/IFundVault.sol";
import "../interfaces/ISUSDToken.sol";

import "../submodules/FundEventAndErrors.sol";

contract FundVault is
    IFundVault,
    FundVaultStorage,
    FundEventAndErrors,
    AccountRBACMixin,
    CollateralMixin,
    OwnableMixin,
    SUSDMixin,
    FundMixin
{
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;
    using MathUtil for uint256;

    function delegateCollateral(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint leverage
    ) external override onlyRoleAuthorized(accountId, "assign") collateralEnabled(collateralType) fundExists(fundId) {
        bytes32 lid = _getLiquidityItemId(accountId, collateralType, fundId, leverage);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        SetUtil.Bytes32Set storage liquidityItemIds = vaultData.liquidityItemIds;

        if (!liquidityItemIds.contains(lid)) {
            if (_getAccountUnassignedCollateral(accountId, collateralType) < amount) {
                revert InsufficientAvailableCollateral(accountId, collateralType, amount);
            }

            // lid not found in set =>  new position
            _addPosition(lid, fundId, accountId, collateralType, amount, leverage);
        } else {
            // Position found, need to adjust (increase, decrease or remove)
            LiquidityItem storage liquidityItem = _fundVaultStore().liquidityItems[lid];

            if (
                liquidityItem.accountId != accountId ||
                liquidityItem.collateralType != collateralType ||
                liquidityItem.fundId != fundId ||
                liquidityItem.leverage != leverage
            ) {
                // Wrong parameters (in fact should be another lid) but prefer to be on the safe side. Check and revert
                revert InvalidParameters();
            }

            uint currentLiquidityAmount = liquidityItem.collateralAmount;

            if (amount == 0) {
                _removePosition(lid, liquidityItem);
            } else if (currentLiquidityAmount < amount) {
                if (_getAccountUnassignedCollateral(accountId, collateralType) < amount - currentLiquidityAmount) {
                    revert InsufficientAvailableCollateral(accountId, collateralType, amount);
                }

                _increasePosition(lid, liquidityItem, amount);
            } else if (currentLiquidityAmount > amount) {
                _decreasePosition(lid, liquidityItem, amount);
            } else {
                // no change
                revert InvalidParameters();
            }
        }

        _rebalanceMarkets(fundId, false);

        emit DelegationUpdated(lid, fundId, accountId, collateralType, amount, leverage);
    }

    function _addPosition(
        bytes32 liquidityItemId,
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount,
        uint leverage
    ) internal {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        uint collateralValue = amount * _getCollateralValue(collateralType);

        // Add liquidityItem into vault
        vaultData.liquidityItemIds.add(liquidityItemId);

        // Add liquidityItem into accounts
        _fundVaultStore().accountliquidityItems[accountId].add(liquidityItemId);

        // Add (if needed) collateral to fund
        if (!_fundVaultStore().fundCollateralTypes[fundId].contains(collateralType)) {
            _fundVaultStore().fundCollateralTypes[fundId].add(collateralType);
        }

        uint shares = _convertToShares(fundId, collateralType, collateralValue, leverage);
        uint initialDebt = _calculateInitialDebt(fundId, collateralType, collateralValue, leverage); // how that works with amount adjustments?

        LiquidityItem memory liquidityItem;
        liquidityItem.collateralType = collateralType;
        liquidityItem.accountId = accountId;
        liquidityItem.fundId = fundId;
        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = shares;
        liquidityItem.initialDebt = initialDebt;
        liquidityItem.leverage = leverage;

        _fundVaultStore().liquidityItems[liquidityItemId] = liquidityItem;

        vaultData.totalShares += liquidityItem.shares;
        vaultData.totalCollateral += amount;

        emit PositionAdded(liquidityItemId, fundId, accountId, collateralType, amount, leverage, shares, initialDebt);
    }

    function _removePosition(bytes32 liquidityItemId, LiquidityItem storage liquidityItem) internal {
        VaultData storage vaultData = _fundVaultStore().fundVaults[liquidityItem.fundId][liquidityItem.collateralType];

        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;
        // uint oldnitialDebt = liquidityItem.initialDebt;
        // TODO check if is enabled to remove position comparing old and new data

        vaultData.liquidityItemIds.remove(liquidityItemId);
        _fundVaultStore().accountliquidityItems[liquidityItem.accountId].remove(liquidityItemId);

        liquidityItem.collateralAmount = 0;
        liquidityItem.shares = 0;
        liquidityItem.initialDebt = 0; // how that works with amount adjustments?

        _fundVaultStore().liquidityItems[liquidityItemId] = liquidityItem;

        vaultData.totalShares -= oldSharesAmount;
        vaultData.totalCollateral -= oldAmount;

        emit PositionRemoved(liquidityItemId, liquidityItem.fundId, liquidityItem.accountId, liquidityItem.collateralType);
    }

    function _increasePosition(
        bytes32 liquidityItemId,
        LiquidityItem storage liquidityItem,
        uint amount
    ) internal {
        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;
        // uint oldnitialDebt = liquidityItem.initialDebt;

        VaultData storage vaultData = _fundVaultStore().fundVaults[liquidityItem.fundId][liquidityItem.collateralType];
        uint collateralValue = amount * _getCollateralValue(liquidityItem.collateralType);

        // TODO check if is enabled to remove position comparing old and new data

        uint shares = _convertToShares(
            liquidityItem.fundId,
            liquidityItem.collateralType,
            collateralValue,
            liquidityItem.leverage
        );
        uint initialDebt = _calculateInitialDebt(
            liquidityItem.fundId,
            liquidityItem.collateralType,
            collateralValue,
            liquidityItem.leverage
        ); // how that works with amount adjustments?

        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = shares;
        liquidityItem.initialDebt = initialDebt;

        _fundVaultStore().liquidityItems[liquidityItemId] = liquidityItem;

        vaultData.totalShares += liquidityItem.shares - oldSharesAmount;
        vaultData.totalCollateral += amount - oldAmount;

        emit PositionIncreased(
            liquidityItemId,
            liquidityItem.fundId,
            liquidityItem.collateralType,
            amount,
            liquidityItem.leverage,
            shares,
            initialDebt
        );
    }

    function _decreasePosition(
        bytes32 liquidityItemId,
        LiquidityItem storage liquidityItem,
        uint amount
    ) internal {
        VaultData storage vaultData = _fundVaultStore().fundVaults[liquidityItem.fundId][liquidityItem.collateralType];
        uint collateralValue = amount * _getCollateralValue(liquidityItem.collateralType);

        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;
        // uint oldnitialDebt = liquidityItem.initialDebt;
        // TODO check if is enabled to remove position comparing old and new data

        uint shares = _convertToShares(
            liquidityItem.fundId,
            liquidityItem.collateralType,
            collateralValue,
            liquidityItem.leverage
        );
        uint initialDebt = _calculateInitialDebt(
            liquidityItem.fundId,
            liquidityItem.collateralType,
            collateralValue,
            liquidityItem.leverage
        ); // how that works with amount adjustments?

        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = shares;
        liquidityItem.initialDebt = initialDebt;

        _fundVaultStore().liquidityItems[liquidityItemId] = liquidityItem;

        vaultData.totalShares -= oldSharesAmount - liquidityItem.shares;
        vaultData.totalCollateral -= oldAmount - amount;

        emit PositionDecreased(
            liquidityItemId,
            liquidityItem.fundId,
            liquidityItem.collateralType,
            amount,
            liquidityItem.leverage,
            shares,
            initialDebt
        );
    }

    function _convertToShares(
        uint fundId,
        address collateralType,
        uint collateralValue,
        uint leverage
    ) internal view returns (uint) {
        uint leveragedCollateralValue = collateralValue * leverage;
        uint totalShares = _totalShares(fundId, collateralType);
        uint totalCollateralValue = _totalCollateral(fundId, collateralType);

        return
            totalShares == 0
                ? leveragedCollateralValue
                : leveragedCollateralValue.mulDivDown(totalShares, totalCollateralValue);
    }

    function _perShareValue(uint fundId, address collateralType) internal view returns (uint) {
        uint totalShares = _totalShares(fundId, collateralType);
        uint totalCollateralValue = _totalCollateral(fundId, collateralType);

        // TODO Use muldivdown
        return totalCollateralValue == 0 ? 1 : totalCollateralValue.mulDivDown(MathUtil.UNIT, totalShares);
    }

    function _totalCollateral(uint fundId, address collateralType) internal view returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].totalCollateral;
    }

    function _totalShares(uint fundId, address collateralType) internal view returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].totalShares;
    }

    // solhint-disable no-unused-vars
    function _calculateInitialDebt(
        uint fundId,
        address collateralType,
        uint collateralValue,
        uint leverage
    ) internal pure returns (uint) {
        return leverage * collateralValue;
    }

    // solhint-enable no-unused-vars

    // ---------------------------------------
    // Mint/Burn sUSD
    // ---------------------------------------

    function mintsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external override onlyRoleAuthorized(accountId, "mint") onlyIfsUSDIsInitialized {
        // TODO Check if can mint that amount

        ISUSDToken(_getSUSDTokenAddress()).mint(msg.sender, amount);
        _fundVaultStore().fundVaults[fundId][collateralType].sUSDByAccount[accountId] += amount;
        _fundVaultStore().fundVaults[fundId][collateralType].totalsUSD += amount;
    }

    function burnsUSD(
        uint fundId,
        uint accountId,
        address collateralType,
        uint amount
    ) external override onlyRoleAuthorized(accountId, "burn") onlyIfsUSDIsInitialized {
        // TODO Check if can burn that amount

        ISUSDToken(_getSUSDTokenAddress()).burn(msg.sender, amount);
        _fundVaultStore().fundVaults[fundId][collateralType].sUSDByAccount[accountId] -= amount;
        _fundVaultStore().fundVaults[fundId][collateralType].totalsUSD -= amount;
    }

    // ---------------------------------------
    // CRatio and Debt queries
    // ---------------------------------------

    function collateralizationRatio(
        uint fundId,
        uint accountId,
        address collateralType
    ) external view override returns (uint) {
        (uint accountDebt, uint accountCollateralValue) = _accountDebtAndCollateral(fundId, accountId, collateralType);
        return accountCollateralValue.mulDivDown(MathUtil.UNIT, accountDebt);
    }

    function accountFundCollateralValue(
        uint fundId,
        uint accountId,
        address collateralType
    ) external view override returns (uint) {
        (, uint accountCollateralValue) = _accountDebtAndCollateral(fundId, accountId, collateralType);
        return accountCollateralValue;
    }

    function accountFundDebt(
        uint fundId,
        uint accountId,
        address collateralType
    ) external view override returns (uint) {
        (uint accountDebt, ) = _accountDebtAndCollateral(fundId, accountId, collateralType);
        return accountDebt;
    }

    function _accountDebtAndCollateral(
        uint fundId,
        uint accountId,
        address collateralType
    ) internal view returns (uint, uint) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        uint perShareValue = _perShareValue(fundId, collateralType);
        uint collateralPrice = _getCollateralValue(collateralType);

        uint accountCollateralValue;
        uint accountDebt = vaultData.sUSDByAccount[accountId]; // add debt from sUSD minted

        for (uint i = 1; i < vaultData.liquidityItemsByAccount[accountId].length() + 1; i++) {
            bytes32 itemId = vaultData.liquidityItemsByAccount[accountId].valueAt(i);
            LiquidityItem storage item = _fundVaultStore().liquidityItems[itemId];
            if (item.collateralType == collateralType) {
                accountCollateralValue += item.collateralAmount * collateralPrice;

                //TODO review formula
                accountDebt +=
                    item.collateralAmount *
                    collateralPrice +
                    item.initialDebt -
                    perShareValue *
                    item.shares *
                    item.leverage;
            }
        }

        return (accountDebt, accountCollateralValue);
    }

    function fundDebt(uint fundId, address collateralType) public view override returns (uint) {
        // TODO Use muldivdown
        return
            _totalShares(fundId, collateralType) *
            _perShareValue(fundId, collateralType) +
            _fundVaultStore().fundVaults[fundId][collateralType].totalsUSD;
    }

    function totalDebtShares(uint fundId, address collateralType) external view override returns (uint) {
        return _totalShares(fundId, collateralType);
    }

    function debtPerShare(uint fundId, address collateralType) external view override returns (uint) {
        return _perShareValue(fundId, collateralType);
    }

    // ---------------------------------------
    // Views
    // ---------------------------------------

    function getLiquidityItem(bytes32 liquidityItemId) public view override returns (LiquidityItem memory liquidityItem) {
        return _fundVaultStore().liquidityItems[liquidityItemId];
    }

    function getAccountLiquidityItemIds(uint accountId) public view override returns (bytes32[] memory liquidityItemIds) {
        return _fundVaultStore().accountliquidityItems[accountId].values();
    }

    function getAccountLiquidityItems(uint accountId)
        external
        view
        override
        returns (LiquidityItem[] memory liquidityItems)
    {
        bytes32[] memory liquidityItemIds = getAccountLiquidityItemIds(accountId);

        liquidityItems = new LiquidityItem[](liquidityItemIds.length);

        for (uint i = 0; i < liquidityItemIds.length; i++) {
            liquidityItems[i] = getLiquidityItem(liquidityItemIds[i]);
        }

        return liquidityItems;
    }

    // ---------------------------------------
    // Helpers / Internals
    // ---------------------------------------

    function _getLiquidityItemId(
        uint accountId,
        address collateralType,
        uint fundId,
        uint leverage
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(accountId, collateralType, fundId, leverage));
    }
}
