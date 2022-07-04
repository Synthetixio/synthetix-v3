//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "../mixins/CollateralMixin.sol";

import "../storage/FundModuleStorage.sol";
import "../storage/FundVaultStorage.sol";
import "../submodules/FundEventAndErrors.sol";

contract FundMixin is FundModuleStorage, FundVaultStorage, FundEventAndErrors, CollateralMixin {
    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;
    using MathUtil for uint256;

    function _ownerOf(uint256 fundId) internal view returns (address) {
        return _fundModuleStore().funds[fundId].owner;
    }

    function _exists(uint256 fundId) internal view returns (bool) {
        return _ownerOf(fundId) != address(0) || fundId == 0; // Reserves id 0 for the 'zero fund'
    }

    modifier fundExists(uint256 fundId) {
        if (!_exists(fundId)) {
            revert FundNotFound(fundId);
        }

        _;
    }

    function _rebalanceMarkets(uint fundId, bool clearsLiquidity) internal {
        FundData storage fundData = _fundModuleStore().funds[fundId];
        uint totalWeights = _fundModuleStore().funds[fundId].totalWeights;

        for (uint i = 0; i < fundData.fundDistribution.length; i++) {
            uint weight = clearsLiquidity ? 0 : fundData.fundDistribution[i].weight;
            _distributeLiquidity(fundId, fundData.fundDistribution[i].market, weight, totalWeights);
        }
    }

    function _distributeLiquidity(
        uint fundId,
        uint marketId,
        uint marketWeight,
        uint totalWeight // solhint-disable-next-line no-empty-blocks
    ) internal {
        uint toAssign = (_totalCollateralValue(fundId) * marketWeight) / totalWeight;
        //TODO push the change to the market
        // MarketMixin._rebalanceMarket(fundId, marketId, toAssign);
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
        uint accountDebt = vaultData.usdByAccount[accountId]; // add debt from USD minted

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

    function _collateralizationRatio(
        uint fundId,
        uint accountId,
        address collateralType
    ) internal view returns (uint) {
        (uint accountDebt, uint accountCollateralValue) = _accountDebtAndCollateral(fundId, accountId, collateralType);
        return accountCollateralValue.mulDivDown(MathUtil.UNIT, accountDebt);
    }

    function _totalCollateral(uint fundId, address collateralType) internal view returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].totalCollateral;
    }

    function _totalCollateralValue(uint fundId) internal view returns (uint) {
        uint total;

        // Note: if funds are single collaterals (and managed independently per collateral type)
        // we should set the collateral type in the fund definition and remove this loop
        for (uint idx = 1; idx <= _fundVaultStore().fundCollateralTypes[fundId].length(); idx++) {
            address collateralType = _fundVaultStore().fundCollateralTypes[fundId].valueAt(idx);
            uint collateral = _fundVaultStore().fundVaults[fundId][collateralType].totalCollateral;
            total = collateral.mulDivDown(_getCollateralValue(collateralType), MathUtil.UNIT);
        }
        return total;
    }

    function _totalShares(uint fundId, address collateralType) internal view returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].totalShares;
    }

    function _perShareValue(uint fundId, address collateralType) internal view returns (uint) {
        uint totalShares = _totalShares(fundId, collateralType);
        uint totalCollateralValue = _totalCollateral(fundId, collateralType);

        // TODO Use muldivdown
        return totalCollateralValue == 0 ? 1 : totalCollateralValue.mulDivDown(MathUtil.UNIT, totalShares);
    }

    function _deleteLiquidityItem(bytes32 liquidityItemId, LiquidityItem storage liquidityItem) internal {
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
}
