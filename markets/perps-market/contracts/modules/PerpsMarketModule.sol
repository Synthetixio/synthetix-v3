//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {IPerpsMarketModule} from "../interfaces/IPerpsMarketModule.sol";

contract PerpsMarketModule is IPerpsMarketModule {
    using PerpsMarket for PerpsMarket.Data;
    using AsyncOrder for AsyncOrder.Data;
    using SetUtil for SetUtil.UintSet;

    function skew(uint128 marketId) external view override returns (int256) {
        return PerpsMarket.load(marketId).skew;
    }

    function size(uint128 marketId) external view override returns (uint256) {
        return PerpsMarket.load(marketId).size;
    }

    function maxOpenInterest(uint128 marketId) external view override returns (uint256) {
        return PerpsMarketConfiguration.load(marketId).maxMarketValue;
    }

    function currentFundingRate(uint128 marketId) external view override returns (int) {
        return PerpsMarket.load(marketId).currentFundingRate();
    }

    function currentFundingVelocity(uint128 marketId) external view override returns (int) {
        return PerpsMarket.load(marketId).currentFundingVelocity();
    }

    function indexPrice(uint128 marketId) external view override returns (uint) {
        return PerpsPrice.getCurrentPrice(marketId);
    }

    function fillPrice(uint128 marketId) external view override returns (uint) {
        return
            AsyncOrder.calculateFillPrice(
                PerpsMarket.load(marketId).skew,
                PerpsMarketConfiguration.load(marketId).skewScale,
                0,
                PerpsPrice.getCurrentPrice(marketId)
            );
    }

    function getMarketSummary(
        uint128 marketId
    ) external view returns (MarketSummary memory summary) {
        PerpsMarket.Data storage market = PerpsMarket.load(marketId);
        return
            MarketSummary({
                skew: market.skew,
                size: market.size,
                maxOpenInterest: this.maxOpenInterest(marketId),
                currentFundingRate: market.currentFundingRate(),
                currentFundingVelocity: market.currentFundingVelocity(),
                indexPrice: this.indexPrice(marketId),
                fillPrice: this.fillPrice(marketId)
            });
    }

    function getAsyncOrdersPaginated(
        uint128 marketId,
        uint256 cursor,
        uint256 amount
    )
        external
        view
        returns (AsyncOrder.Data[] memory orders, uint256 nextCursor, uint256 pageSize)
    {
        PerpsMarket.Data storage market = PerpsMarket.load(marketId);

        uint256 length = market.asyncOrdersSet.length();
        pageSize = amount > length - cursor ? length - cursor : amount;

        orders = new AsyncOrder.Data[](amount);
        for (uint i = 0; i < length; i++) {
            orders[i] = market.asyncOrders[market.asyncOrdersSet.valueAt(i)];
        }

        return (orders, cursor + pageSize, pageSize);
    }
}
