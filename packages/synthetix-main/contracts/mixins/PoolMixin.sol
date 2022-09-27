//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "../mixins/CollateralMixin.sol";
import "../mixins/MarketManagerMixin.sol";

import "../storage/PoolModuleStorage.sol";
import "../storage/VaultStorage.sol";

contract PoolMixin is PoolModuleStorage, VaultStorage, CollateralMixin, MarketManagerMixin {
    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.Bytes32Set;
    using MathUtil for uint256;

    using SharesLibrary for SharesLibrary.Distribution;

    error PoolNotFound(uint poolId);

    function _ownerOf(uint256 poolId) internal view returns (address) {
        return _poolModuleStore().pools[poolId].owner;
    }

    function _exists(uint256 poolId) internal view returns (bool) {
        return _ownerOf(poolId) != address(0) || poolId == 0; // Reserves id 0 for the 'zero pool'
    }

    modifier poolExists(uint256 poolId) {
        if (!_exists(poolId)) {
            revert PoolNotFound(poolId);
        }

        _;
    }

    function _rebalancePoolConfigurations(uint poolId) internal {
        PoolData storage poolData = _poolModuleStore().pools[poolId];
        uint totalWeights = poolData.totalWeights;

        if (totalWeights == 0) {
            // nothing to rebalance
            return;
        }

        SharesLibrary.Distribution storage poolDist = poolData.debtDist;

        // after applying the pool share multiplier, we have USD liquidity

        int totalAllocatableLiquidity = poolData.totalLiquidity;
        int cumulativeDebtChange = 0;

        for (uint i = 0; i < poolData.poolDistribution.length; i++) {
            MarketDistribution storage marketDistribution = poolData.poolDistribution[i];
            uint weight = marketDistribution.weight;
            uint amount = totalAllocatableLiquidity > 0 ? (uint(totalAllocatableLiquidity) * weight) / totalWeights : 0;

            int permissibleLiquidity = _calculatePermissibleLiquidity(marketDistribution.market);

            cumulativeDebtChange += _rebalanceMarket(
                marketDistribution.market,
                poolId,
                permissibleLiquidity < marketDistribution.maxDebtShareValue
                    ? permissibleLiquidity
                    : marketDistribution.maxDebtShareValue,
                amount
            );
        }

        poolDist.distribute(cumulativeDebtChange);
    }

    function _calculatePermissibleLiquidity(uint marketId) internal view returns (int) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];
        uint minRatio = _poolModuleStore().minLiquidityRatio;
        return
            marketData.debtDist.valuePerShare / 1e9 + int(minRatio > 0 ? MathUtil.UNIT.divDecimal(minRatio) : MathUtil.UNIT);
    }

    function _distributePoolDebt(uint poolId) internal {
        _rebalancePoolConfigurations(poolId);
    }

    function _distributeVaultDebt(uint poolId, address collateralType) internal {
        PoolData storage poolData = _poolModuleStore().pools[poolId];
        VaultData storage vaultData = _vaultStore().vaults[poolId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        // update vault collateral price
        uint collateralPrice = _getCollateralPrice(collateralType);

        uint liquidityMultiplier = epochData.liquidityMultiplier;

        if (liquidityMultiplier == 0) {
            liquidityMultiplier = MathUtil.UNIT;
            epochData.liquidityMultiplier = uint128(liquidityMultiplier);
        }

        vaultData.collateralPrice = uint128(collateralPrice);

        // TODO: this second `_distributePoolDebt` call is really only needed for distributing the most up-to-date debt info from the markets (
        // which needs to happen prior to the `` call), but
        // we don't need to rebalance them
        _distributePoolDebt(poolId);

        bytes32 actorId = bytes32(uint(uint160(collateralType)));

        uint oldVaultShares = poolData.debtDist.getActorShares(actorId);

        uint newVaultShares = uint(epochData.debtDist.totalShares).mulDecimal(collateralPrice);

        int debtChange = poolData.debtDist.updateActorShares(actorId, newVaultShares);

        // update totalLiquidity
        _poolModuleStore().pools[poolId].totalLiquidity += int128( // change in liquidity value
            int(newVaultShares.mulDecimal(epochData.liquidityMultiplier)) -
                int(oldVaultShares.mulDecimal(epochData.liquidityMultiplier)) -
                // change in vault debt
                debtChange
        );

        epochData.debtDist.distribute(debtChange);

        // total debt unfortunately needs to be cached here for liquidations
        epochData.unclaimedDebt += int128(debtChange);

        _distributePoolDebt(poolId);
    }

    function _updatePositionDebt(
        uint accountId,
        uint poolId,
        address collateralType
    ) internal returns (int currentDebt) {
        _distributeVaultDebt(poolId, collateralType);

        VaultData storage vaultData = _vaultStore().vaults[poolId][collateralType];
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

    function _positionCollateral(
        uint accountId,
        uint poolId,
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
        VaultData storage vaultData = _vaultStore().vaults[poolId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        uint collateralPrice = _getCollateralPrice(collateralType);

        collateralAmount = uint(epochData.collateralDist.getActorValue(bytes32(accountId)));
        collateralValue = collateralPrice.mulDecimal(collateralAmount);

        shares = epochData.debtDist.totalShares;
    }

    function _positionCollateralizationRatio(
        uint accountId,
        uint poolId,
        address collateralType
    ) internal returns (uint) {
        (, uint getPositionCollateralValue, ) = _positionCollateral(accountId, poolId, collateralType);
        int getPositionDebt = _updatePositionDebt(accountId, poolId, collateralType);

        // if they have a credit, just treat their debt as 0
        return getPositionCollateralValue.divDecimal(getPositionDebt < 0 ? 0 : uint(getPositionDebt));
    }

    function _vaultDebt(uint poolId, address collateralType) internal returns (int) {
        _distributeVaultDebt(poolId, collateralType);

        VaultData storage vaultData = _vaultStore().vaults[poolId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        return epochData.unclaimedDebt + epochData.usdDebtDist.totalValue();
    }

    function _vaultCollateralRatio(uint poolId, address collateralType) internal returns (uint) {
        (, uint collateralValue) = _vaultCollateral(poolId, collateralType);

        int debt = _vaultDebt(poolId, collateralType);

        // if they have a credit, just treat their debt as 0
        return debt <= 0 ? 0 : collateralValue.divDecimal(uint(debt));
    }

    function _vaultCollateral(uint poolId, address collateralType)
        internal
        view
        returns (uint collateralAmount, uint collateralValue)
    {
        VaultData storage vaultData = _vaultStore().vaults[poolId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        collateralAmount = uint(epochData.collateralDist.totalValue());
        collateralValue = _getCollateralPrice(collateralType).mulDecimal(collateralAmount);
    }
}
