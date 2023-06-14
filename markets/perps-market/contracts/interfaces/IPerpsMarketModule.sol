//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AsyncOrder} from "../storage/AsyncOrder.sol";

/**
 * @title Perps market module
 */
interface IPerpsMarketModule {
    struct MarketSummary {
        int256 skew;
        uint256 size;
        uint256 maxOpenInterest;
        int currentFundingRate;
        int currentFundingVelocity;
        uint indexPrice;
    }

    function skew(uint128 marketId) external view returns (int256);

    function size(uint128 marketId) external view returns (uint256);

    function maxOpenInterest(uint128 marketId) external view returns (uint256);

    function currentFundingRate(uint128 marketId) external view returns (int);

    function currentFundingVelocity(uint128 marketId) external view returns (int);

    function indexPrice(uint128 marketId) external view returns (uint);

    function fillPrice(uint128 marketId, int orderSize, uint price) external returns (uint);

    /**
     * @dev Given a marketId return a market's summary details in one call.
     */
    function getMarketSummary(
        uint128 marketId
    ) external view returns (MarketSummary memory summary);
}
