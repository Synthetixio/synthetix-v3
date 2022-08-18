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

    using SharesLibrary for SharesLibrary.Distribution;

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

        SharesLibrary.Distribution storage fundDist = _fundVaultStore().fundDists[fundId];

        // at this point, shares represent USD liquidity
        // TODO: with liquidations, probably need to apply a multiplier here
        uint totalAllocatableLiquidity = fundDist.totalShares;
        int cumulativeDebtChange = 0;

        for (uint i = 0; i < fundData.fundDistribution.length; i++) {
            MarketDistribution storage marketDistribution = fundData.fundDistribution[i];
            uint weight = clearsLiquidity ? 0 : marketDistribution.weight;
            uint amount = totalAllocatableLiquidity * weight / totalWeights;

            cumulativeDebtChange +=
                _rebalanceMarket(marketDistribution.market, fundId, marketDistribution.maxDebtShareValue, amount);
        }

        fundDist.distribute(cumulativeDebtChange, 0, 0);
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

    function _distributeVaultAccountDebt(uint fundId, address collateralType) internal {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        _distributeFundVaultDebt(fundId);

        uint newVaultShares = vaultData.debtDist.totalShares
            .mulDecimal(vaultData.sharesMultiplier)
            .mulDecimal(vaultData.collateralPrice);

        int debtChange = _fundVaultStore().fundDists[fundId].updateDistributionActor(
            bytes32(fundId), 
            newVaultShares
        );

        vaultData.debtDist.distribute(debtChange, 0, 0);
    }

    function _updateAccountDebt(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal returns (int currentDebt) {

        _distributeVaultAccountDebt(fundId, collateralType);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        LiquidityItem storage li = _fundVaultStore().liquidityItems[
            _getLiquidityItemId(accountId, fundId, collateralType)
        ];

        li.cumulativeDebt += int128(vaultData.debtDist.updateDistributionActor(bytes32(accountId), li.shares));
        int usdMinted = int128(li.usdMinted);

        return uint(li.lastDebt + usdMinted);
    }

    function _accountCollateral(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal view returns (uint collateralAmount, uint collateralValue, uint shares) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        LiquidityItem storage li = _fundVaultStore().liquidityItems[
            _getLiquidityItemId(accountId, fundId, collateralType)
        ];

        uint collateralPrice = _getCollateralValue(collateralType);

        collateralAmount = vaultData.totalCollateral * 
            uint(li.shares).divDecimal(li.leverage) / 
            vaultData.totalShares;

        collateralValue = collateralAmount.mulDecimal(collateralPrice);
        shares = li.shares;
    }

    function _accountCollateralRatio(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal returns (uint) {
        (, uint accountCollateralValue, ) = _accountCollateral(accountId, fundId, collateralType);
        uint accountDebt = _updateAccountDebt(accountId, fundId, collateralType);

        // if they have a credit, just treat their debt as 0
        return accountCollateralValue.divDecimal(accountDebt < 0 ? 0 : uint(accountDebt));
    }

    function _totalCollateral(uint fundId, address collateralType) internal view returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].totalCollateral;
    }

    function _deleteLiquidityItem(bytes32 liquidityItemId, LiquidityItem storage liquidityItem) internal {
        VaultData storage vaultData = _fundVaultStore().fundVaults[liquidityItem.fundId][liquidityItem.collateralType];

        uint128 oldSharesAmount = liquidityItem.shares;

        vaultData.liquidityItemIds.remove(liquidityItemId);

        liquidityItem.shares = 0;
        liquidityItem.leverage = 0;

        liquidityItem.lastDebt = 0;
        liquidityItem.usdMinted = 0;

        vaultData.totalShares -= oldSharesAmount;
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
