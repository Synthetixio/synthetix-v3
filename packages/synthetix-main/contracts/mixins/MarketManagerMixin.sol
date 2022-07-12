//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";
import "../interfaces/IMarket.sol";

import "../storage/MarketManagerStorage.sol";

contract MarketManagerMixin is MarketManagerStorage {
    function _rebalanceMarket(
        uint marketId,
        uint fundId,
        uint maxDebtShareValue, // (in USD)
        uint amount // in collateralValue (USD)
    ) internal {
        // this function is called by the fund at rebalance markets
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        // Adjust maxShareValue weighted average
        _adjustMaxShareValue(marketData, fundId, maxDebtShareValue, amount);

        // Adjust fund shares
        _adjustFundShares(marketData, fundId, amount);
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
    ) internal {
        uint currentFundShares = marketData.fundliquidityShares[fundId];
        uint currentFundAmount = SharesLibrary.sharesToAmount(
            marketData.totalLiquidityShares,
            marketData.totalDelegatedCollateralValue,
            currentFundShares
        );

        if (amount >= currentFundAmount) {
            // liquidity provided by the fund increased. Add the delta
            uint deltaAmount = amount - currentFundAmount;
            uint deltaShares = SharesLibrary.amountToShares(
                marketData.totalLiquidityShares,
                marketData.totalDelegatedCollateralValue,
                deltaAmount
            );
            marketData.fundliquidityShares[fundId] += deltaShares;
            marketData.fundInitialBalance[fundId] += int(deltaAmount);
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
            marketData.fundInitialBalance[fundId] -= int(deltaAmount);
            marketData.totalLiquidityShares -= deltaShares;
            marketData.totalDelegatedCollateralValue -= deltaAmount;
        }
    }

    // function _supplyTarget(uint marketId) internal view returns (uint) {
    //     return uint(int(_marketManagerStore().markets[marketId].totalDelegatedCollateralValue) + _totalBalance(marketId));
    // }

    function _totalBalance(uint marketId) internal view returns (int) {
        return
            IMarket(_marketManagerStore().markets[marketId].marketAddress).balance() +
            _marketManagerStore().markets[marketId].issuance;
    }
}
