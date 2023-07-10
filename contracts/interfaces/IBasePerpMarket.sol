//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IBasePerpMarket {
    // --- Shared Events --- //

    // @dev Emitted when funding is computed.
    event FundingRecomputed(uint128 marketId, int256 skew, int256 fundingRate, int256 fundingVelocity);
}
