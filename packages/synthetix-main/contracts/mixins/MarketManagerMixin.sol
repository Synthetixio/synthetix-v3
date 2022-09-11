//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";
import "../interfaces/external/IMarket.sol";

import "../storage/MarketManagerStorage.sol";
import "../storage/PoolModuleStorage.sol";

contract MarketManagerMixin is MarketManagerStorage, PoolModuleStorage {
    using MathUtil for uint256;
    using SharesLibrary for SharesLibrary.Distribution;
    using HeapUtil for HeapUtil.Data;

    error MarketNotFound(uint marketId);

    error MaxDebtPerShareTooLow(uint marketId, int requestedMaxDebtPerShare, int maximumMaxDebtPerShare);

    function _rebalanceMarket(
        uint marketId,
        uint poolId,
        int maxDebtShareValue, // (in USD)
        uint amount // in collateralValue (USD)
    ) internal returns (int debtChange) {
        // this function is called by the pool at rebalance markets
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        if (marketData.marketAddress == address(0)) {
            revert MarketNotFound(marketId);
        }

        _distributeMarket(marketData, 9999999999);

        return _adjustVaultShares(marketData, poolId, amount, maxDebtShareValue);
    }

    function _adjustVaultShares(
        MarketData storage marketData,
        uint poolId,
        uint newLiquidity,
        int newPoolMaxShareValue
    ) internal returns (int debtChange) {
        uint oldLiquidity = marketData.debtDist.getActorShares(bytes32(poolId));
        int oldPoolMaxShareValue = -marketData.inRangePools.getById(uint128(poolId)).priority;

        //require(oldPoolMaxShareValue == 0, "value is not 0");
        //require(newPoolMaxShareValue == 0, "new pool max share value is in fact set");

        if (newPoolMaxShareValue <= marketData.debtDist.valuePerShare / 1e9) {
            // this will ensure calculations below can correctly gauge shares changes
            newLiquidity = 0;
            marketData.inRangePools.extractById(uint128(poolId));
        } else {
            marketData.inRangePools.insert(uint128(poolId), -int128(int(newPoolMaxShareValue)));
        }

        debtChange = marketData.debtDist.updateActorShares(bytes32(poolId), newLiquidity);

        // recalculate market capacity
        if (newPoolMaxShareValue > marketData.debtDist.valuePerShare / 1e9) {
            marketData.capacity += uint128(
                uint((newPoolMaxShareValue - marketData.debtDist.valuePerShare / 1e9)).mulDecimal(newLiquidity)
            );
        }

        if (oldPoolMaxShareValue > marketData.debtDist.valuePerShare / 1e9) {
            marketData.capacity -= uint128(
                uint((oldPoolMaxShareValue - marketData.debtDist.valuePerShare / 1e9)).mulDecimal(oldLiquidity)
            );
        }
    }

    // the second parameter exists to act as an escape hatch/discourage aginst griefing
    function _distributeMarket(MarketData storage marketData, uint maxIter) internal {
        if (marketData.debtDist.totalShares == 0) {
            // market cannot distribute (or accumulate) any debt when there are no shares
            return;
        }

        // get the latest market balance
        int targetBalance = _totalBalance(marketData);

        int curBalance = marketData.lastMarketBalance;

        int targetDebtPerDebtShare = marketData.debtDist.valuePerShare /
            1e9 +
            (((targetBalance - curBalance) * MathUtil.INT_UNIT) / int128(marketData.debtDist.totalShares));

        // this loop should rarely execute the body. When it does, it only executes once for each pool that passes the limit.
        // since `_distributeMarket` is not run for most pools, market users are not hit with any overhead as a result of this,
        // additionally,
        for (
            uint i = 0;
            marketData.inRangePools.size() > 0 &&
                -marketData.inRangePools.getMax().priority < targetDebtPerDebtShare &&
                i < maxIter;
            i++
        ) {
            HeapUtil.Node memory nextRemove = marketData.inRangePools.extractMax();

            // distribute to limit
            int debtAmount = (int(int128(marketData.debtDist.totalShares)) *
                (-nextRemove.priority - marketData.debtDist.valuePerShare / 1e9)) / 1e18;

            marketData.debtDist.distribute(debtAmount);

            // sanity
            //require(marketData.debtDist.valuePerShare/1e9 == -nextRemove.priority, "distribution calculation is borked");

            curBalance += debtAmount;

            // sanity
            require(marketData.debtDist.getActorShares(bytes32(uint(nextRemove.id))) > 0, "no shares on actor removal");

            // detach market from pool (the pool will remain "detached" until the pool manager specifies a new debtDist)

            int newPoolDebt = marketData.debtDist.updateActorShares(bytes32(uint(nextRemove.id)), 0);
            _poolModuleStore().pools[nextRemove.id].debtDist.distribute(newPoolDebt);

            // note: we don't have to update the capacity because pool max share value - valuePerShare = 0, so no change
            // and conceptually it makes sense because this pools contribution to the capacity should have been used at this point

            if (marketData.debtDist.totalShares == 0) {
                // we just popped the last pool, can't move the market balance any higher
                marketData.lastMarketBalance = int128(curBalance);
                return;
            }

            targetDebtPerDebtShare =
                marketData.debtDist.valuePerShare +
                (((targetBalance - curBalance) * MathUtil.INT_UNIT) / int128(marketData.debtDist.totalShares));
        }

        marketData.debtDist.distribute(targetBalance - curBalance);
        marketData.lastMarketBalance = int128(targetBalance);
    }

    function _getReportedDebt(MarketData storage marketData) internal view returns (uint) {
        return IMarket(marketData.marketAddress).reportedDebt();
    }

    function _totalBalance(MarketData storage marketData) internal view returns (int) {
        return int(IMarket(marketData.marketAddress).reportedDebt()) + marketData.issuance;
    }
}
