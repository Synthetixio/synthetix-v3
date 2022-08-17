//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";
import "../interfaces/IMarket.sol";

import "../storage/MarketManagerStorage.sol";

contract MarketManagerMixin is MarketManagerStorage {
    using SharesLibrary for SharesLibrary.Distribution;

    function _rebalanceMarket(
        uint marketId,
        uint fundId,
        uint maxDebtShareValue, // (in USD)
        uint amount // in collateralValue (USD)
    ) internal returns (int debtChange) {
        // this function is called by the fund at rebalance markets
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        // Adjust maxShareValue weighted average
        _adjustMaxShareValue(marketData, fundId, maxDebtShareValue, amount);

        // Adjust fund shares
        return _adjustFundShares(marketData, fundId, amount);
    }

    function _adjustMaxShareValue(
        MarketData storage marketData,
        uint fundId,
        uint maxDebtShareValue,
        uint amount
    ) internal {
        uint currentFundDebtShares = marketData.fundliquidityShares[fundId];
        uint newFundDebtShare = SharesLibrary.amountToShares(
            marketData.totalLiquidityShares,
            marketData.totalDelegatedCollateralValue,
            amount
        );

        uint currentTotalDebtShares = marketData.totalLiquidityShares;
        uint newTotalDebtShares = marketData.totalLiquidityShares - currentFundDebtShares + newFundDebtShare;

        uint currentFundMaxDebtShareValue = marketData.fundMaxDebtShareValue[fundId]; // here or from call data

        // Start calculations
        uint currentMaxMarketDebtShare = marketData.maxMarketDebtShare;
        uint newMaxMarketDebtShare = currentMaxMarketDebtShare -
            ((currentFundMaxDebtShareValue * currentFundDebtShares) / currentTotalDebtShares) +
            ((currentMaxMarketDebtShare * currentFundDebtShares) / currentTotalDebtShares);

        newMaxMarketDebtShare =
            newMaxMarketDebtShare +
            ((maxDebtShareValue * newFundDebtShare) / newTotalDebtShares) -
            ((newMaxMarketDebtShare * newFundDebtShare) / newTotalDebtShares);

        marketData.fundMaxDebtShareValue[fundId] = maxDebtShareValue;
        marketData.maxMarketDebtShare = newMaxMarketDebtShare;
    }

    function _adjustFundShares(
        MarketData storage marketData,
        uint fundId,
        uint amount
    ) internal returns (int debtChange) {
        uint currentFundShares = marketData.fundliquidityShares[fundId];
        uint currentFundAmount = SharesLibrary.sharesToAmount(
            marketData.totalLiquidityShares,
            marketData.totalDelegatedCollateralValue,
            currentFundShares
        );

        // if this market is being newly funded, ensure the `amountPerShare` is set to `1` to start
        if (marketData.totalLiquidityShares == 0) {
            marketData.debtDist.amountPerShare = uint128(MathUtil.UNIT);
        }

        debtChange = marketData.debtDist.updateDistributionActor(fundId, currentFundShares, marketData.totalLiquidityShares);

        if (amount >= currentFundAmount) {
            // liquidity provided by the fund increased. Add the delta
            uint deltaAmount = amount - currentFundAmount;
            uint deltaShares = SharesLibrary.amountToShares(
                marketData.totalLiquidityShares,
                marketData.totalDelegatedCollateralValue,
                deltaAmount
            );
            marketData.fundliquidityShares[fundId] += deltaShares;
            marketData.totalLiquidityShares += deltaShares;
            marketData.totalDelegatedCollateralValue += deltaAmount;
        } else {
            // liquidity provided by the fund decreased. Substract the delta
            uint deltaAmount = currentFundAmount - amount;
            uint deltaShares = SharesLibrary.amountToShares(
                marketData.totalLiquidityShares,
                marketData.totalDelegatedCollateralValue,
                deltaAmount
            );
            marketData.fundliquidityShares[fundId] -= deltaShares;
            marketData.totalLiquidityShares -= deltaShares;
            marketData.totalDelegatedCollateralValue -= deltaAmount;
        }
    }

    function _distributeMarketFundDebt(uint[] memory marketIds) internal {
        // figure out how much debt is in all the fund attached markets. then distribute. then report.

        // TODO: when adjusting debt here, determine if there is a fund which needs to be removed/added from
        // distribution. if so, do an intermediate distribute
        
        for (uint i = 0;i < marketIds.length;i++) {
            // get the latest market balance
            int balance = _totalBalance(marketIds[i]);

            MarketData storage marketData = _marketManagerStore().markets[marketIds[i]];

            marketData.debtDist.distribute(marketData.totalLiquidityShares, balance - marketData.lastMarketBalance, 0, 0);

            marketData.lastMarketBalance = balance;
        }
    }

    function _totalBalance(uint marketId) internal view returns (int) {
        return
            IMarket(_marketManagerStore().markets[marketId].marketAddress).balance() +
            _marketManagerStore().markets[marketId].issuance;
    }
}
