//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {IPerpsMarketModule} from "../interfaces/IPerpsMarketModule.sol";

/**
 * @title Module for getting perps market information.
 * @dev See IPerpsMarketModule.
 */
contract PerpsMarketModule is IPerpsMarketModule {
    using PerpsMarket for PerpsMarket.Data;

    /**
     * @inheritdoc IPerpsMarketModule
     */
    function metadata(
        uint128 marketId
    ) external view override returns (string memory name, string memory symbol) {
        PerpsMarket.Data storage market = PerpsMarket.load(marketId);
        return (market.name, market.symbol);
    }

    /**
     * @inheritdoc IPerpsMarketModule
     */
    function skew(uint128 marketId) external view override returns (int256) {
        return PerpsMarket.load(marketId).skew;
    }

    /**
     * @inheritdoc IPerpsMarketModule
     */
    function size(uint128 marketId) external view override returns (uint256) {
        return PerpsMarket.load(marketId).size;
    }

    /**
     * @inheritdoc IPerpsMarketModule
     */
    function maxOpenInterest(uint128 marketId) external view override returns (uint256) {
        return PerpsMarketConfiguration.load(marketId).maxMarketSize;
    }

    /**
     * @inheritdoc IPerpsMarketModule
     */
    function currentFundingRate(uint128 marketId) external view override returns (int256) {
        return PerpsMarket.load(marketId).currentFundingRate();
    }

    /**
     * @inheritdoc IPerpsMarketModule
     */
    function currentFundingVelocity(uint128 marketId) external view override returns (int256) {
        return PerpsMarket.load(marketId).currentFundingVelocity();
    }

    /**
     * @inheritdoc IPerpsMarketModule
     */
    function indexPrice(uint128 marketId) external view override returns (uint256) {
        return PerpsPrice.getCurrentPrice(marketId, PerpsPrice.Tolerance.DEFAULT);
    }

    /**
     * @inheritdoc IPerpsMarketModule
     */
    function fillPrice(
        uint128 marketId,
        int128 orderSize,
        uint256 price
    ) external view override returns (uint256) {
        return
            AsyncOrder.calculateFillPrice(
                PerpsMarket.load(marketId).skew,
                PerpsMarketConfiguration.load(marketId).skewScale,
                orderSize,
                price
            );
    }

    /**
     * @inheritdoc IPerpsMarketModule
     */
    function getMarketSummary(
        uint128 marketId
    ) external view override returns (MarketSummary memory summary) {
        PerpsMarket.Data storage market = PerpsMarket.load(marketId);
        return
            MarketSummary({
                skew: market.skew,
                size: market.size,
                maxOpenInterest: this.maxOpenInterest(marketId),
                currentFundingRate: market.currentFundingRate(),
                currentFundingVelocity: market.currentFundingVelocity(),
                indexPrice: this.indexPrice(marketId)
            });
    }
}
