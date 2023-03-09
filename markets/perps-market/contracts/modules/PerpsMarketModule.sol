//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/PerpsMarket.sol";
import "../storage/MarketConfiguration.sol";
import "../storage/PerpsPrice.sol";
import "../storage/AsyncOrder.sol";
import "../interfaces/IPerpsMarketModule.sol";

contract PerpsMarketModule is IPerpsMarketModule {
    using PerpsMarket for PerpsMarket.Data;

    function skew(uint128 marketId ) external view override returns (int256){
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);
        return perpsMarket.skew;
    }
    function size(uint128 marketId ) external view override returns (uint256){
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);
        return perpsMarket.size;
    }
    function maxOpenInterest(uint128 marketId ) external view override returns (uint256){
        MarketConfiguration.Data storage marketConfiguration = MarketConfiguration.load(marketId);
        return marketConfiguration.maxMarketValue;
    }
    function currentFundingRate(uint128 marketId ) external view override returns (int){
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);
        return perpsMarket.currentFundingRate();
    }
    function indexPrice(uint128 marketId ) external view override returns (uint){
        return PerpsPrice.getCurrentPrice(marketId);
    }
    function fillPrice(uint128 marketId ) external view override returns (uint){
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);
        MarketConfiguration.Data storage marketConfiguration = MarketConfiguration.load(marketId);
        
        // To get the current fill price we pass in size 0
        int sizeToUse = 0;

        return AsyncOrder.calculateFillPrice(perpsMarket.skew,marketConfiguration.skewScale, sizeToUse, PerpsPrice.getCurrentPrice(marketId) );
    }
}