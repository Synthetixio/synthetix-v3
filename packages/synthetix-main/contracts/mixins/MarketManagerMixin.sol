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
        uint maxDebtShareValue, // (in USD)
        uint amount // in collateralValue (USD)
    ) internal returns (int debtChange) {
        // this function is called by the fund at rebalance markets
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        _distributeMarket(marketData);

        // Adjust maxShareValue weighted average
        //_adjustMaxShareValue(marketData, fundId, maxDebtShareValue, amount);

        // Adjust fund shares
        return _adjustFundShares(marketData, fundId, amount, maxDebtShareValue);
    }

    function _adjustFundShares(
        MarketData storage marketData,
        uint fundId,
        uint newLiquidity,
        uint newMaxShareValue
    ) internal returns (int debtChange) {
        uint oldLiquidity = marketData.debtDist.getActorShares(bytes32(fundId));
        uint oldMaxDebtShareValue = uint(uint128(-marketData.fundMaxDebtShares.getById(uint128(fundId)).priority));
        uint oldTotalLiquidity = marketData.debtDist.totalShares;
        debtChange = marketData.debtDist.updateDistributionActor(bytes32(fundId), newLiquidity);

        // recalculate max market debt share
        uint oldMaxMarketDebtShare = marketData.maxMarketDebtShare;
        uint newMaxMarketDebtShare = oldMaxMarketDebtShare -
            ((oldMaxDebtShareValue * oldLiquidity) / oldTotalLiquidity) +
            ((newMaxShareValue * newLiquidity) / marketData.debtDist.totalShares);

        newMaxMarketDebtShare =
            newMaxMarketDebtShare +
            ((oldMaxMarketDebtShare * oldLiquidity) / oldTotalLiquidity) -
            ((newMaxMarketDebtShare * newLiquidity) / marketData.debtDist.totalShares);

        marketData.fundMaxDebtShares.insert(uint128(fundId), -int128(int(newMaxShareValue)));
        marketData.maxMarketDebtShare = newMaxMarketDebtShare;
    }

    function _distributeMarket(
        MarketData storage marketData
    ) internal {
        // get the latest market balance
        int targetBalance = _totalBalance(marketData);

        int curBalance = marketData.lastMarketBalance;

        // this loop should rarely execute. When it does, it only executes once for each fund that passes the limit.
        // controls need to happen elsewhere to ensure markets don't get hit with useless funds which cause people to fail withdraw
        while (-marketData.fundMaxDebtShares.getMax().priority < targetBalance) {
            Heap.Node memory nextRemove = marketData.fundMaxDebtShares.extractMax();

            // distribute to limit
            marketData.debtDist.distribute(-nextRemove.priority - curBalance, 0, 0);
            curBalance = -nextRemove.priority;


            // detach market from fund
            marketData.debtDist.updateDistributionActor(bytes32(uint(nextRemove.id)), 0);
        }

        // todo: loop for putting funds back in as well?

        marketData.debtDist.distribute(targetBalance - curBalance, 0, 0);

        marketData.lastMarketBalance = targetBalance;
    }

    function _totalBalance(MarketData storage marketData) internal view returns (int) {
        return
            IMarket(marketData.marketAddress).balance() +
                marketData.issuance;
    }
}
