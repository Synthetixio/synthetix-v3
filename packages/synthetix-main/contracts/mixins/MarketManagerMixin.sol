//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";
import "../interfaces/IMarket.sol";

import "../storage/MarketManagerStorage.sol";

contract MarketManagerMixin is MarketManagerStorage {
    using SharesLibrary for SharesLibrary.Distribution;
    using Heap for Heap.Data;

    error MarketNotFound(uint marketId);

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

        _distributeMarket(marketData);

        //if (marketData.debtDist.valuePerShare < maxDebtShareValue) {
            // Adjust fund shares
            return _adjustFundShares(marketData, fundId, amount, maxDebtShareValue);
        //}
    }

    function _adjustFundShares(
        MarketData storage marketData,
        uint fundId,
        uint newLiquidity,
        int newFundMaxShareValue
    ) internal returns (int debtChange) {
        uint oldLiquidity = marketData.debtDist.getActorShares(bytes32(fundId));
        int oldFundMaxShareValue = -marketData.fundMaxDebtShares.getById(uint128(fundId)).priority;

        debtChange = marketData.debtDist.updateActorShares(bytes32(fundId), newLiquidity);

        // recalculate max market debt nominator
        marketData.maxMarketDebtNominator = 
            marketData.maxMarketDebtNominator +
            int(newLiquidity) * newFundMaxShareValue -
            int(oldLiquidity) * oldFundMaxShareValue;

        if (newLiquidity > 0) {
            marketData.fundMaxDebtShares.insert(uint128(fundId), -int128(int(newFundMaxShareValue)));
        }
        else {
            marketData.fundMaxDebtShares.extractById(uint128(fundId));
        }
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

        /*int targetDebtPerDebtShare = targetBalance * MathUtil.INT_UNIT / int128(marketData.debtDist.totalShares);

        // this loop should rarely execute. When it does, it only executes once for each fund that passes the limit.
        // controls need to happen elsewhere to ensure markets don't get hit with useless funds which cause people to fail withdraw
        while (-marketData.fundMaxDebtShares.getMax().priority < targetDebtPerDebtShare) {
            Heap.Node memory nextRemove = marketData.fundMaxDebtShares.extractMax();

            // distribute to limit
            marketData.debtDist.distribute(-nextRemove.priority - curBalance);
            curBalance = -nextRemove.priority;


            // detach market from fund
            marketData.debtDist.updateActorShares(bytes32(uint(nextRemove.id)), 0);
        }*/

        // todo: loop for putting funds back in as well?

        marketData.debtDist.distribute(targetBalance - curBalance);

        marketData.lastMarketBalance = int128(targetBalance);
    }

    function _totalBalance(MarketData storage marketData) internal view returns (int) {
        return
            int(IMarket(marketData.marketAddress).balance()) +
                marketData.issuance;
    }
}
