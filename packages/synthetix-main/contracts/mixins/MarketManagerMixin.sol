//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";
import "../interfaces/IMarket.sol";

import "../storage/MarketManagerStorage.sol";
import "../storage/FundModuleStorage.sol";

contract MarketManagerMixin is MarketManagerStorage, FundModuleStorage {
    using MathUtil for uint256;
    using SharesLibrary for SharesLibrary.Distribution;
    using Heap for Heap.Data;

    error MarketNotFound(uint marketId);

    error MaxDebtPerShareTooLow(uint marketId, int requestedMaxDebtPerShare, int maximumMaxDebtPerShare);

    function _rebalanceMarket(
        uint marketId,
        uint fundId,
        int maxDebtShareValue, // (in USD)
        uint amount // in collateralValue (USD)
    ) internal returns (int debtChange) {
        // this function is called by the fund at rebalance markets
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        if (marketData.marketAddress == address(0)) {
            revert MarketNotFound(marketId);
        }

        _distributeMarket(marketData, 9999999999);

        return _adjustFundShares(marketData, fundId, amount, maxDebtShareValue);
    }

    function _adjustFundShares(
        MarketData storage marketData,
        uint fundId,
        uint newLiquidity,
        int newFundMaxShareValue
    ) internal returns (int debtChange) {
        uint oldLiquidity = marketData.debtDist.getActorShares(bytes32(fundId));
        int oldFundMaxShareValue = -marketData.inRangeFunds.getById(uint128(fundId)).priority;

        //require(oldFundMaxShareValue == 0, "value is not 0");
        //require(newFundMaxShareValue == 0, "new fund max share value is in fact set");

        if (newFundMaxShareValue <= marketData.debtDist.valuePerShare / 1e9) {
            // this will ensure calculations below can correctly gauge shares changes
            newLiquidity = 0;
            marketData.inRangeFunds.extractById(uint128(fundId));
        } else {
            marketData.inRangeFunds.insert(uint128(fundId), -int128(int(newFundMaxShareValue)));
        }

        debtChange = marketData.debtDist.updateActorShares(bytes32(fundId), newLiquidity);

        // recalculate market capacity
        if (newFundMaxShareValue > marketData.debtDist.valuePerShare / 1e9) {
            marketData.capacity += uint128(
                uint((newFundMaxShareValue - marketData.debtDist.valuePerShare / 1e9)).mulDecimal(newLiquidity)
            );
        }

        if (oldFundMaxShareValue > marketData.debtDist.valuePerShare / 1e9) {
            marketData.capacity -= uint128(
                uint((oldFundMaxShareValue - marketData.debtDist.valuePerShare / 1e9)).mulDecimal(oldLiquidity)
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

        // this loop should rarely execute the body. When it does, it only executes once for each fund that passes the limit.
        // since `_distributeMarket` is not run for most funds, market users are not hit with any overhead as a result of this,
        // additionally,
        for (
            uint i = 0;
            marketData.inRangeFunds.size() > 0 &&
                -marketData.inRangeFunds.getMax().priority < targetDebtPerDebtShare &&
                i < maxIter;
            i++
        ) {
            Heap.Node memory nextRemove = marketData.inRangeFunds.extractMax();

            // distribute to limit
            int debtAmount = (int(int128(marketData.debtDist.totalShares)) *
                (-nextRemove.priority - marketData.debtDist.valuePerShare / 1e9)) / 1e18;

            marketData.debtDist.distribute(debtAmount);

            // sanity
            //require(marketData.debtDist.valuePerShare/1e9 == -nextRemove.priority, "distribution calculation is borked");

            curBalance += debtAmount;

            // sanity
            require(marketData.debtDist.getActorShares(bytes32(uint(nextRemove.id))) > 0, "no shares on actor removal");

            // detach market from fund (the fund will remain "detached" until the fund manager specifies a new debtDist)

            int newFundDebt = marketData.debtDist.updateActorShares(bytes32(uint(nextRemove.id)), 0);
            _fundModuleStore().funds[nextRemove.id].debtDist.distribute(newFundDebt);

            // note: we don't have to update the capacity because fund max share value - valuePerShare = 0, so no change
            // and conceptually it makes sense because this funds contribution to the capacity should have been used at this point

            if (marketData.debtDist.totalShares == 0) {
                // we just popped the last fund, can't move the market balance any higher
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

    function _totalBalance(MarketData storage marketData) internal view returns (int) {
        return int(IMarket(marketData.marketAddress).balance()) + marketData.issuance;
    }
}
