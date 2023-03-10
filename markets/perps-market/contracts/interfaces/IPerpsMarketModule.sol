//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Perps market module
 */
interface IPerpsMarketModule {
    function skew(uint128 marketId) external view returns (int256);

    function size(uint128 marketId) external view returns (uint256);

    function maxOpenInterest(uint128 marketId) external view returns (uint256);

    function currentFundingRate(uint128 marketId) external view returns (int);

    function indexPrice(uint128 marketId) external view returns (uint);

    function fillPrice(uint128 marketId) external view returns (uint);
}
