//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";
import "../interfaces/IMarket.sol";

import "../storage/MarketManagerStorage.sol";

contract MarketManagerMixin is MarketManagerStorage {
    function _rebalanceMarket(
        uint marketId,
        uint fundId,
        uint amount // in collateralValue (USD)
    ) internal {
        // called by the fund at rebalance markets
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        uint previousFundShares = marketData.fundliquidityShares[fundId];
        uint previousFundAmount = SharesLibrary.sharesToAmount(
            marketData.totalLiquidityShares,
            marketData.totalDelegatedCollateralValue,
            previousFundShares
        );

        if (amount >= previousFundAmount) {
            // Added liquidity
            uint deltaAmount = amount - previousFundAmount;
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
            // Removed liquidity
            uint deltaAmount = previousFundAmount - amount;
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
