//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";
import "../interfaces/IMarket.sol";

import "../storage/MarketManagerStorage.sol";

contract MarketManagerMixin is MarketManagerStorage {
    using SharesLibrary for SharesLibrary.Distribution;
    using Heap for Heap.Data;

    function _rebalanceMarket(
        uint marketId,
        uint fundId,
        int maxDebtShareValue, // (in USD)
        uint amount // in collateralValue (USD)
    ) internal returns (int debtChange) {
        // this function is called by the fund at rebalance markets
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        _distributeMarket(marketData);

        if (marketData.debtDist.valuePerShare < maxDebtShareValue) {
            // Adjust fund shares
            return _adjustFundShares(marketData, fundId, amount, maxDebtShareValue);
        }
    }

    function _adjustFundShares(
        MarketData storage marketData,
        uint fundId,
        uint newLiquidity,
        int newFundMaxShareValue
    ) internal returns (int debtChange) {
        uint oldLiquidity = marketData.debtDist.getActorShares(bytes32(fundId));
        int oldFundMaxDebtShareValue = -marketData.fundMaxDebtShares.getById(uint128(fundId)).priority;
        uint oldTotalLiquidity = marketData.debtDist.totalShares;
        debtChange = marketData.debtDist.updateActorShares(bytes32(fundId), newLiquidity);

        // recalculate max market debt share
        int newMarketMaxShareValue = newFundMaxShareValue;

        if (oldTotalLiquidity > 0 && newLiquidity > 0) {
            int oldMarketMaxShareValue = int(marketData.maxMarketDebt) / int128(marketData.debtDist.totalShares);

            newMarketMaxShareValue = oldMarketMaxShareValue -
                (oldFundMaxDebtShareValue * int(oldLiquidity) / int(oldTotalLiquidity)) +
                (newFundMaxShareValue * int(newLiquidity) / int128(marketData.debtDist.totalShares));

            newMarketMaxShareValue =
                newMarketMaxShareValue +
                (oldMarketMaxShareValue * int(oldLiquidity) / int(oldTotalLiquidity)) -
                (oldMarketMaxShareValue * int(newLiquidity) / int128(marketData.debtDist.totalShares));
        }

        marketData.fundMaxDebtShares.insert(uint128(fundId), -int128(int(newFundMaxShareValue)));
        marketData.maxMarketDebt = int128((newMarketMaxShareValue * int(int128(marketData.debtDist.totalShares))) / MathUtil.INT_UNIT);
    }

    function _distributeMarket(
        MarketData storage marketData
    ) internal {
        if (marketData.debtDist.totalShares == 0) {
            // market cannot distribute (or accumulate) any debt when there are no shares
            return;
        }

        // get the latest market balance
        int targetBalance = _totalBalance(marketData);

        int curBalance = marketData.lastMarketBalance;

        int targetDebtPerDebtShare = targetBalance * MathUtil.INT_UNIT / int128(marketData.debtDist.totalShares);

        // this loop should rarely execute. When it does, it only executes once for each fund that passes the limit.
        // controls need to happen elsewhere to ensure markets don't get hit with useless funds which cause people to fail withdraw
        while (-marketData.fundMaxDebtShares.getMax().priority < targetDebtPerDebtShare) {
            Heap.Node memory nextRemove = marketData.fundMaxDebtShares.extractMax();

            // distribute to limit
            marketData.debtDist.distribute(-nextRemove.priority - curBalance);
            curBalance = -nextRemove.priority;


            // detach market from fund
            marketData.debtDist.updateActorShares(bytes32(uint(nextRemove.id)), 0);
        }

        // todo: loop for putting funds back in as well?

        marketData.debtDist.distribute(targetBalance - curBalance);

        marketData.lastMarketBalance = int128(targetBalance);
    }

    function _totalBalance(MarketData storage marketData) internal view returns (int) {
        return
            IMarket(marketData.marketAddress).balance() +
                marketData.issuance;
    }
}
