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

        uint totalAllocatableLiquidity = 0;
        for (uint idx = 0; idx < _fundVaultStore().fundCollateralTypes[fundId].length(); idx++) {
            address collateralType = _fundVaultStore().fundCollateralTypes[fundId].valueAt(idx);
            totalAllocatableLiquidity += _totalVaultLiquidity(fundId, collateralType);
        }

        int cumulativeDebtChange = 0;

        for (uint i = 0; i < fundData.fundDistribution.length; i++) {
            MarketDistribution storage marketDistribution = fundData.fundDistribution[i];
            uint weight = clearsLiquidity ? 0 : marketDistribution.weight;
            uint amount = totalAllocatableLiquidity * weight / totalWeights;

            cumulativeDebtChange +=
                _rebalanceMarket(marketDistribution.market, fundId, marketDistribution.maxDebtShareValue, amount);
        }

        fundData.lastDebt += cumulativeDebtChange;
    }

    function _distributeFundVaultDebt(uint fundId) internal {
        FundData storage fundData = _fundModuleStore().funds[fundId];

        // first, ensure any debt is accrued with the markets as currently balanced

        uint[] memory marketIds = new uint[](fundData.fundDistribution.length);

        for (uint i = 0;i < marketIds.length;i++) {
            marketIds[i] = fundData.fundDistribution[i].market;
        }

        _distributeMarketFundDebt(marketIds);

        // then, accrue the debt
        // todo: gas usage could be improved here
        _rebalanceFundPositions(fundId, false);
    }

    function _accountAmounts(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal view returns (uint shares, uint debt, uint collateralValue) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        uint perShareCollateral = _perShareCollateral(fundId, collateralType);

        uint collateralPrice = _getCollateralValue(collateralType);
        uint perShareValue = perShareCollateral.mulDecimal(collateralPrice);

        LiquidityItem storage li = _fundVaultStore().liquidityItems[
            _getLiquidityItemId(accountId, fundId, collateralType)
        ];

        collateralValue = uint(li.collateralAmount).mulDecimal(collateralPrice);
        shares = li.shares;

        // todo: run _distributeVaultFundDebt
        // todo: should be shares multiplied by value of shares
        debt = uint(int(shares.divDecimal(li.leverage)) + int(li.lastDebt));
    }

    function _collateralizationRatio(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal view returns (uint) {
        (, uint accountDebt, uint accountCollateralValue) = _accountAmounts(accountId, fundId, collateralType);
        return accountCollateralValue.divDecimal(accountDebt);
    }

    function _totalCollateral(uint fundId, address collateralType) internal view returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].totalCollateral;
    }

    function _totalShares(uint fundId, address collateralType) internal view returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].totalShares;
    }

    function _totalVaultLiquidity(uint fundId, address collateralType) internal view returns (uint) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        return uint(vaultData.totalShares).mulDecimal(vaultData.sharesMultiplier);
    }

    function _perShareCollateral(uint fundId, address collateralType) internal view returns (uint) {
        uint totalShares = _totalShares(fundId, collateralType);

        if (totalShares == 0) {
            return 0;
        }

        uint totalCollateralValue = _totalCollateral(fundId, collateralType);

        return totalCollateralValue == 0 ? MathUtil.UNIT : totalCollateralValue.divDecimal(totalShares);
    }

    function _deleteLiquidityItem(bytes32 liquidityItemId, LiquidityItem storage liquidityItem) internal {
        VaultData storage vaultData = _fundVaultStore().fundVaults[liquidityItem.fundId][liquidityItem.collateralType];

        uint128 oldAmount = liquidityItem.collateralAmount;
        uint128 oldSharesAmount = liquidityItem.shares;
        // uint oldnitialDebt = liquidityItem.initialDebt;
        // TODO check if is enabled to remove position comparing old and new data

        vaultData.liquidityItemIds.remove(liquidityItemId);

        liquidityItem.collateralAmount = 0;
        liquidityItem.shares = 0;
        liquidityItem.lastDebt = 0; // how that works with amount adjustments?

        _fundVaultStore().liquidityItems[liquidityItemId] = liquidityItem;

        vaultData.totalShares -= oldSharesAmount;
        vaultData.totalCollateral -= oldAmount;
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
