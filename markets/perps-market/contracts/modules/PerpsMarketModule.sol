//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/PerpsMarket.sol";
import "../storage/MarketConfiguration.sol";
import "../storage/PerpsPrice.sol";
import "../storage/AsyncOrder.sol";
import "../interfaces/IPerpsMarketModule.sol";

contract PerpsMarketModule is IPerpsMarketModule {
    using PerpsMarket for PerpsMarket.Data;

    function skew(uint128 marketId) external view override returns (int256) {
        return PerpsMarket.load(marketId).skew;
    }

    function size(uint128 marketId) external view override returns (uint256) {
        return PerpsMarket.load(marketId).size;
    }

    function maxOpenInterest(uint128 marketId) external view override returns (uint256) {
        return MarketConfiguration.load(marketId).maxMarketValue;
    }

    function currentFundingRate(uint128 marketId) external view override returns (int) {
        return PerpsMarket.load(marketId).currentFundingRate();
    }

    function indexPrice(uint128 marketId) external view override returns (uint) {
        return PerpsPrice.getCurrentPrice(marketId);
    }

    function fillPrice(uint128 marketId) external view override returns (uint) {
        // To get the current fill price we pass in size 0
        int sizeToUse = 0;
        return
            AsyncOrder.calculateFillPrice(
                PerpsMarket.load(marketId).skew,
                MarketConfiguration.load(marketId).skewScale,
                sizeToUse,
                PerpsPrice.getCurrentPrice(marketId)
            );
    }
}
