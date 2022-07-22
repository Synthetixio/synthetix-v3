//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "../mixins/CollateralMixin.sol";
import "../mixins/MarketManagerMixin.sol";

import "../storage/FundModuleStorage.sol";
import "../storage/FundVaultStorage.sol";
import "../submodules/FundEventAndErrors.sol";

contract FundMixin is FundModuleStorage, FundVaultStorage, FundEventAndErrors, CollateralMixin, MarketManagerMixin {
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

    function _rebalanceFundPositions(uint fundId, bool clearsLiquidity) internal {
        FundData storage fundData = _fundModuleStore().funds[fundId];
        uint totalWeights = _fundModuleStore().funds[fundId].totalWeights;

        for (uint i = 0; i < fundData.fundDistribution.length; i++) {
            MarketDistribution storage marketDistribution = fundData.fundDistribution[i];
            uint weight = clearsLiquidity ? 0 : marketDistribution.weight;
            _distributeLiquidity(
                fundId,
                marketDistribution.market,
                marketDistribution.maxDebtShareValue,
                weight,
                totalWeights
            );
        }
    }

    function _distributeLiquidity(
        uint fundId,
        uint marketId,
        uint maxDebtShareValue,
        uint marketWeight,
        uint totalWeight
    ) internal {
        // Rebalance Markets per type of collateral (individual fund-collateral vaults)
        for (uint idx = 1; idx < _fundVaultStore().fundCollateralTypes[fundId].length(); idx++) {
            // TODO Verify with product if there's only one collateral type allowed per fund
            // If there's only one collateralType per fund => this for loop is not needed since
            // will iterate only once
            address collateralType = _fundVaultStore().fundCollateralTypes[fundId].valueAt(idx);

            uint collateral = _fundVaultStore().fundVaults[fundId][collateralType].totalCollateral;
            uint collateralValue = collateral.mulDecimal(_getCollateralValue(collateralType));

            uint toAssign = (collateralValue * marketWeight) / totalWeight;
            _rebalanceMarket(marketId, fundId, maxDebtShareValue, toAssign); //rebalanceMarket from MarketMixin
        }
    }

    function _accountDebtAndCollateral(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal view returns (uint, uint) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        uint perShareCollateral = _perShareCollateral(fundId, collateralType);
        uint collateralPrice = _getCollateralValue(collateralType);
        uint perShareValue = perShareCollateral.mulDecimal(collateralPrice);

        uint accountCollateralValue;
        uint accountDebt = vaultData.usdByAccount[accountId]; // add debt from USD minted
        SetUtil.Bytes32Set storage accountliquidityItems = vaultData.liquidityItemsByAccount[accountId];

        for (uint i = 1; i < accountliquidityItems.length() + 1; i++) {
            bytes32 itemId = accountliquidityItems.valueAt(i);
            LiquidityItem storage item = _fundVaultStore().liquidityItems[itemId];

            assert(item.collateralType == collateralType); // sanity check. There shouldn't be any liquidity item with different collateral here

            uint itemAccountCollateralValue = item.collateralAmount.mulDecimal(collateralPrice);

            accountCollateralValue += itemAccountCollateralValue;

            //TODO review formula
            accountDebt +=
                itemAccountCollateralValue +
                item.initialDebt -
                item.shares.mulDecimal(perShareValue) *
                item.leverage;
        }

        return (accountDebt, accountCollateralValue);
    }

    function _collateralizationRatio(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal view returns (uint) {
        (uint accountDebt, uint accountCollateralValue) = _accountDebtAndCollateral(accountId, fundId, collateralType);
        return accountCollateralValue.divDecimal(accountDebt);
    }

    function _totalCollateral(uint fundId, address collateralType) internal view returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].totalCollateral;
    }

    function _totalShares(uint fundId, address collateralType) internal view returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].totalShares;
    }

    function _perShareCollateral(uint fundId, address collateralType) internal view returns (uint) {
        uint totalShares = _totalShares(fundId, collateralType);
        uint totalCollateralValue = _totalCollateral(fundId, collateralType);

        return totalCollateralValue == 0 ? 1 : totalCollateralValue.divDecimal(totalShares);
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

        emit PositionRemoved(liquidityItemId, liquidityItem.accountId, liquidityItem.fundId, liquidityItem.collateralType);
    }
}
