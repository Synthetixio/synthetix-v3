//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IBasePerpMarket {
    // --- Shared Events --- //

    // @dev Emitted when funding is computed.
    event FundingRecomputed(uint128 marketId, int256 skew, int256 fundingRate, int256 fundingVelocity);

    // @dev Emitted when a stale order was canceled.
    event OrderCanceled(uint128 accountId, uint128 marketId);
}
