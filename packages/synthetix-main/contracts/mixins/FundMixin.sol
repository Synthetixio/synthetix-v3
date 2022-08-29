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

    function _rebalanceFundPositions(uint fundId) internal {
        FundData storage fundData = _fundModuleStore().funds[fundId];
        uint totalWeights = fundData.totalWeights;

        if (totalWeights == 0) {
            // nothing to rebalance
            return;
        }

        SharesLibrary.Distribution storage fundDist = fundData.debtDist;

        // after applying the fund share multiplier, we have USD liquidity

        int totalAllocatableLiquidity = fundData.totalLiquidity;
        int cumulativeDebtChange = 0;

        for (uint i = 0; i < fundData.fundDistribution.length; i++) {
            MarketDistribution storage marketDistribution = fundData.fundDistribution[i];
            uint weight = marketDistribution.weight;
            uint amount = totalAllocatableLiquidity > 0 ? (uint(totalAllocatableLiquidity) * weight) / totalWeights : 0;

            int permissibleLiquidity = _calculatePermissibleLiquidity(marketDistribution.market);

            cumulativeDebtChange += _rebalanceMarket(
                marketDistribution.market,
                fundId,
                permissibleLiquidity < marketDistribution.maxDebtShareValue
                    ? permissibleLiquidity
                    : marketDistribution.maxDebtShareValue,
                amount
            );
        }

        fundDist.distribute(cumulativeDebtChange);
    }

    function _calculatePermissibleLiquidity(uint marketId) internal view returns (int) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];
        uint minRatio = _fundModuleStore().minLiquidityRatio;
        return
            marketData.debtDist.valuePerShare / 1e9 + int(minRatio > 0 ? MathUtil.UNIT.divDecimal(minRatio) : MathUtil.UNIT);
    }

    function _distributeFundDebt(uint fundId) internal {
        _rebalanceFundPositions(fundId);
    }

    function _distributeVaultDebt(uint fundId, address collateralType) internal {
        FundData storage fundData = _fundModuleStore().funds[fundId];
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        // update vault collateral price
        uint collateralPrice = _getCollateralValue(collateralType);

        uint liquidityMultiplier = epochData.liquidityMultiplier;

        if (liquidityMultiplier == 0) {
            liquidityMultiplier = MathUtil.UNIT;
            epochData.liquidityMultiplier = uint128(liquidityMultiplier);
        }

        vaultData.collateralPrice = uint128(collateralPrice);

        // TODO: this second `_distributeFundDebt` call is really only needed for distributing the most up-to-date debt info from the markets (
        // which needs to happen prior to the `` call), but
        // we don't need to rebalance them
        _distributeFundDebt(fundId);

        bytes32 actorId = bytes32(uint(uint160(collateralType)));

        uint oldVaultShares = fundData.debtDist.getActorShares(actorId);

        uint newVaultShares = uint(epochData.debtDist.totalShares).mulDecimal(collateralPrice);

        int debtChange = fundData.debtDist.updateActorShares(actorId, newVaultShares);

        // update totalLiquidity
        _fundModuleStore().funds[fundId].totalLiquidity += int128( // change in liquidity value
            int(newVaultShares.mulDecimal(epochData.liquidityMultiplier)) -
                int(oldVaultShares.mulDecimal(epochData.liquidityMultiplier)) -
                // change in vault debt
                debtChange
        );

        epochData.debtDist.distribute(debtChange);

        // total debt unfortunately needs to be cached here for liquidations
        epochData.unclaimedDebt += int128(debtChange);

        _distributeFundDebt(fundId);
    }

    function _updateAccountDebt(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal returns (int currentDebt) {
        _distributeVaultDebt(fundId, collateralType);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        bytes32 actorId = bytes32(accountId);

        currentDebt = epochData.usdDebtDist.getActorValue(actorId);
        int newDebt = epochData.debtDist.accumulateActor(actorId);

        currentDebt += newDebt;

        epochData.usdDebtDist.updateActorValue(actorId, currentDebt);
        epochData.unclaimedDebt -= int128(newDebt);
    }

    function _updateAvailableRewards(
        VaultEpochData storage epochData,
        RewardDistribution[] storage dists,
        uint accountId
    ) internal returns (uint[] memory) {
        uint totalShares = epochData.debtDist.totalShares;

        uint[] memory rewards = new uint[](dists.length);
        for (uint i = 0; i < dists.length; i++) {
            if (address(dists[i].distributor) == address(0)) {
                continue;
            }

            dists[i].rewardPerShare += uint128(SharesLibrary.updateEntry(dists[i].entry, totalShares));

            dists[i].actorInfo[accountId].pendingSend += uint128(
                uint(
                    (epochData.debtDist.getActorShares(bytes32(accountId)) *

                        (dists[i].rewardPerShare - dists[i].actorInfo[accountId].lastRewardPerShare)) / 1e18
                )
            );

            dists[i].actorInfo[accountId].lastRewardPerShare = dists[i].rewardPerShare;

            rewards[i] = dists[i].actorInfo[accountId].pendingSend;
        }

        return rewards;
    }

    function _accountCollateral(
        uint accountId,
        uint fundId,
        address collateralType
    )
        internal
        view
        returns (
            uint collateralAmount,
            uint collateralValue,
            uint shares
        )
    {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        uint collateralPrice = _getCollateralValue(collateralType);

        collateralAmount = uint(epochData.collateralDist.getActorValue(bytes32(accountId)));
        collateralValue = collateralPrice.mulDecimal(collateralAmount);

        shares = epochData.debtDist.totalShares;
    }

    function _accountCollateralRatio(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal returns (uint) {
        (, uint accountCollateralValue, ) = _accountCollateral(accountId, fundId, collateralType);
        int accountDebt = _updateAccountDebt(accountId, fundId, collateralType);

        // if they have a credit, just treat their debt as 0
        return accountCollateralValue.divDecimal(accountDebt < 0 ? 0 : uint(accountDebt));
    }

    function _vaultDebt(uint fundId, address collateralType) internal returns (int) {
        _distributeVaultDebt(fundId, collateralType);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        return epochData.unclaimedDebt + epochData.usdDebtDist.totalValue();
    }

    function _vaultCollateralRatio(uint fundId, address collateralType) internal returns (uint) {
        (, uint collateralValue) = _vaultCollateral(fundId, collateralType);

        int debt = _vaultDebt(fundId, collateralType);

        // if they have a credit, just treat their debt as 0
        return debt <= 0 ? 0 : collateralValue.divDecimal(uint(debt));
    }

    function _vaultCollateral(uint fundId, address collateralType)
        internal
        view
        returns (uint collateralAmount, uint collateralValue)
    {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        collateralAmount = uint(epochData.collateralDist.totalValue());
        collateralValue = _getCollateralValue(collateralType).mulDecimal(collateralAmount);
    }
}
