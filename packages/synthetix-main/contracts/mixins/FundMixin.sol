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

        if (totalWeights == 0) {
            // nothing to rebalance
            return;
        }

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

        fundDist.distribute(cumulativeDebtChange);
    }

    function _distributeFundDebt(uint fundId) internal {
        // then, accrue the debt
        _rebalanceFundPositions(fundId, false);
    }

    function _distributeVaultDebt(uint fundId, address collateralType) internal {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        // update vault collateral price
        uint collateralPrice = _getCollateralValue(collateralType);

        if (vaultData.sharesMultiplier == 0) {
            vaultData.sharesMultiplier = uint128(MathUtil.UNIT);
        }

        vaultData.collateralPrice = uint128(collateralPrice);

        _distributeFundDebt(fundId);

        uint newVaultShares = uint(vaultData.debtDist.totalShares)
            .mulDecimal(vaultData.sharesMultiplier)
            .mulDecimal(collateralPrice);

        int debtChange = _fundVaultStore().fundDists[fundId].updateDistributionActor(
            bytes32(fundId), 
            newVaultShares
        );

        vaultData.debtDist.distribute(debtChange);

        // total debt unfortunately needs to be cached here for liquidations
        vaultData.totalDebt += int128(debtChange);
    }

    function _updateAccountDebt(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal returns (int currentDebt) {

        _distributeVaultDebt(fundId, collateralType);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        LiquidityItem storage li = _fundVaultStore().liquidityItems[
            _getLiquidityItemId(accountId, fundId, collateralType)
        ];

        li.cumulativeDebt += int128(vaultData.debtDist.updateDistributionActor(
            bytes32(accountId), 
            vaultData.debtDist.getActorShares(bytes32(accountId))
        ));

        return li.cumulativeDebt + int128(li.usdMinted);
    }

    //error Test(uint rps,uint lrps);

    function _updateAvailableRewards(
        VaultData storage vaultData,
        uint accountId
    ) internal returns (uint[] memory) {
        RewardDistribution[] storage dists = vaultData.rewards;

        uint totalShares = vaultData.debtDist.totalShares;

        uint[] memory rewards = new uint[](dists.length);
        for (uint i = 0; i < dists.length; i++) {
            if (address(dists[i].distributor) == address(0)) {
                continue;
            }

            dists[i].rewardPerShare += uint128(SharesLibrary.updateDistributionEntry(dists[i].entry, totalShares));

            dists[i].actorInfo[accountId].pendingSend += 
                uint128(uint(vaultData.debtDist.getActorShares(bytes32(accountId)) * 
                (dists[i].rewardPerShare - dists[i].actorInfo[accountId].lastRewardPerShare) / 1e18));

            dists[i].actorInfo[accountId].lastRewardPerShare = dists[i].rewardPerShare;

            rewards[i] = dists[i].actorInfo[accountId].pendingSend;
        }

        return rewards;
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

        shares = vaultData.debtDist.getActorShares(bytes32(accountId));

        if (shares == 0) {
            // TODO: in the future, its possible user has collateral in account
            // but no leverage. if that is the case, we need to account for that here
            collateralAmount = 0;
            collateralValue = 0;
        }
        else {
            collateralAmount = uint(vaultData.totalCollateral) * 
                shares.divDecimal(li.leverage) / 
                vaultData.debtDist.totalShares;

            collateralValue = collateralAmount.mulDecimal(collateralPrice);
        }
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

    function _totalCollateral(uint fundId, address collateralType) internal view returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].totalCollateral;
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
