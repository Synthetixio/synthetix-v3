//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";
import "../interfaces/IMarket.sol";

import "../storage/MarketManagerStorage.sol";

contract MarketManagerMixin is MarketManagerStorage {
    function _rebalanceMarket(
        uint marketId,
        uint fundId,
        uint amount
    ) internal {
        // called by the fund at rebalance markets
        // mapping(uint => uint) fundliquidityShares;
        // mapping(uint => int) fundInitialBalance;

        MarketData storage marketData = _marketManagerStore().markets[marketId];
        // int currentFundBalance = fundBalance(marketId, fundId);
        uint currentSupplyTarget = _supplyTarget(marketId); // cannot be negative, if so, revert.

        marketData.fundliquidityShares[fundId] = SharesLibrary.amountToShares(
            marketData.totalLiquidityShares,
            currentSupplyTarget,
            amount
        );
    }

    function _supplyTarget(uint marketId) internal view returns (uint) {
        return uint(int(_marketManagerStore().markets[marketId].delegatedCollateralValue) + _totalBalance(marketId));
    }

    function _totalBalance(uint marketId) internal view returns (int) {
        return
            IMarket(_marketManagerStore().markets[marketId].marketAddress).balance() +
            _marketManagerStore().markets[marketId].issuance;
    }
}
