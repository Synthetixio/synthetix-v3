//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IMarketEvents {
    event MarketUpdated(
        uint128 marketId,
        int256 skew,
        uint256 size,
        int256 sizeDelta,
        int256 currentFundingRate,
        int256 currentFundingVelocity
    );
}
