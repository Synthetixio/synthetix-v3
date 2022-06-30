//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/FundModuleStorage.sol";
import "../submodules/FundEventAndErrors.sol";

contract FundMixin is FundModuleStorage, FundEventAndErrors {
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
        uint toAssign = marketWeight / totalWeight 
        // TODO implement it when markets are created
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
    ) internal view override returns (uint) {
        (uint accountDebt, uint accountCollateralValue) = _accountDebtAndCollateral(fundId, accountId, collateralType);
        return accountCollateralValue.mulDivDown(MathUtil.UNIT, accountDebt);
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
