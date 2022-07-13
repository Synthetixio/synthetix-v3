//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "../mixins/AccountRBACMixin.sol";
import "../mixins/FundMixin.sol";
import "../mixins/USDMixin.sol";

import "../utils/SharesLibrary.sol";

import "../storage/FundVaultStorage.sol";
import "../interfaces/IVaultModule.sol";
import "../interfaces/IUSDToken.sol";

import "../submodules/FundEventAndErrors.sol";

contract VaultModule is
    IVaultModule,
    FundVaultStorage,
    FundEventAndErrors,
    AccountRBACMixin,
    OwnableMixin,
    USDMixin,
    FundMixin
{
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;
    using MathUtil for uint256;

    error InvalidLeverage(uint leverage);

    function delegateCollateral(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount,
        uint leverage
    ) external override onlyRoleAuthorized(accountId, "assign") collateralEnabled(collateralType) fundExists(fundId) {
        // Fix leverage to 1 until it's enabled
        if (leverage != 1) revert InvalidLeverage(leverage);

        bytes32 lid = _getLiquidityItemId(accountId, fundId, collateralType);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        SetUtil.Bytes32Set storage liquidityItemIds = vaultData.liquidityItemIds;

        if (!liquidityItemIds.contains(lid)) {
            if (_getAccountUnassignedCollateral(accountId, collateralType) < amount) {
                revert InsufficientAvailableCollateral(accountId, collateralType, amount);
            }

            // lid not found in set =>  new position
            _addPosition(lid, accountId, fundId, collateralType, amount, leverage);
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

        _rebalanceFundPositions(fundId, false);

        emit DelegationUpdated(lid, accountId, fundId, collateralType, amount, leverage);
    }

    function _addPosition(
        bytes32 liquidityItemId,
        uint accountId,
        uint fundId,
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

        uint shares = _calculateShares(fundId, collateralType, collateralValue, leverage);
        uint initialDebt = _calculateInitialDebt(collateralValue, leverage); // how that works with amount adjustments?

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

        emit PositionAdded(liquidityItemId, accountId, fundId, collateralType, amount, leverage, shares, initialDebt);
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

        emit PositionRemoved(liquidityItemId, liquidityItem.accountId, liquidityItem.fundId, liquidityItem.collateralType);
    }

    function _increasePosition(
        bytes32 liquidityItemId,
        LiquidityItem storage liquidityItem,
        uint amount
    ) internal {
        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;

        VaultData storage vaultData = _fundVaultStore().fundVaults[liquidityItem.fundId][liquidityItem.collateralType];
        uint collateralValue = amount * _getCollateralValue(liquidityItem.collateralType);

        // TODO check if is enabled to remove position comparing old and new data

        uint shares = _calculateShares(
            liquidityItem.fundId,
            liquidityItem.collateralType,
            collateralValue,
            liquidityItem.leverage
        );
        uint initialDebt = _calculateInitialDebt(collateralValue, liquidityItem.leverage); // how that works with amount adjustments?

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

        uint shares = _calculateShares(
            liquidityItem.fundId,
            liquidityItem.collateralType,
            collateralValue,
            liquidityItem.leverage
        );
        uint initialDebt = _calculateInitialDebt(collateralValue, liquidityItem.leverage); // how that works with amount adjustments?

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

    function _calculateShares(
        uint fundId,
        address collateralType,
        uint collateralValue,
        uint leverage
    ) internal view returns (uint) {
        uint leveragedCollateralValue = collateralValue * leverage;
        uint totalShares = _totalShares(fundId, collateralType);
        uint totalCollateralValue = _totalCollateral(fundId, collateralType);

        return SharesLibrary.amountToShares(totalShares, totalCollateralValue, leveragedCollateralValue);
    }

    function _calculateInitialDebt(uint collateralValue, uint leverage) internal pure returns (uint) {
        return leverage * collateralValue;
    }

    // ---------------------------------------
    // Mint/Burn USD
    // ---------------------------------------

    function mintUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external override onlyRoleAuthorized(accountId, "mint") onlyIfUSDIsInitialized {
        // TODO Check if can mint that amount

        IUSDToken(_getUSDTokenAddress()).mint(msg.sender, amount);
        _fundVaultStore().fundVaults[fundId][collateralType].usdByAccount[accountId] += amount;
        _fundVaultStore().fundVaults[fundId][collateralType].totalUSD += amount;
    }

    function burnUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external override onlyRoleAuthorized(accountId, "burn") onlyIfUSDIsInitialized {
        // TODO Check if can burn that amount

        IUSDToken(_getUSDTokenAddress()).burn(msg.sender, amount);
        _fundVaultStore().fundVaults[fundId][collateralType].usdByAccount[accountId] -= amount;
        _fundVaultStore().fundVaults[fundId][collateralType].totalUSD -= amount;
    }

    // ---------------------------------------
    // CRatio and Debt queries
    // ---------------------------------------

    function collateralizationRatio(
        uint accountId,
        uint fundId,
        address collateralType
    ) external view override returns (uint) {
        return _collateralizationRatio(fundId, accountId, collateralType);
    }

    function accountFundCollateralValue(
        uint accountId,
        uint fundId,
        address collateralType
    ) external view override returns (uint) {
        (, uint accountCollateralValue) = _accountDebtAndCollateral(accountId, fundId, collateralType);
        return accountCollateralValue;
    }

    function accountFundDebt(
        uint accountId,
        uint fundId,
        address collateralType
    ) external view override returns (uint) {
        (uint accountDebt, ) = _accountDebtAndCollateral(accountId, fundId, collateralType);
        return accountDebt;
    }

    function fundDebt(uint fundId, address collateralType) public view override returns (uint) {
        return
            _totalShares(fundId, collateralType).mulDecimal(_debtPerShare(fundId, collateralType)) +
            _fundVaultStore().fundVaults[fundId][collateralType].totalUSD;
    }

    function totalDebtShares(uint fundId, address collateralType) external view override returns (uint) {
        return _totalShares(fundId, collateralType);
    }

    function debtPerShare(uint fundId, address collateralType) external view override returns (uint) {
        return _debtPerShare(fundId, collateralType);
    }

    function _debtPerShare(uint fundId, address collateralType) internal view returns (uint) {
        return _perShareCollateral(fundId, collateralType).mulDecimal(_getCollateralValue(collateralType));
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
        uint fundId,
        address collateralType
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(accountId, fundId, collateralType));
    }
}
