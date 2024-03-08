//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IBasePerpMarket {
    // --- Shared Events --- //

    // @notice Emitted when funding is computed.
    event FundingRecomputed(
        uint128 marketId,
        int256 skew,
        int256 fundingRate,
        int256 fundingVelocity
    );

    // @notice Emitted when utilization is computed.
    event UtilizationRecomputed(uint128 marketId, int256 skew, uint256 utilizationRate);

    // @notice Emitted when an order is canceled.
    event OrderCanceled(
        uint128 accountId,
        uint128 marketId,
        uint256 keeperFee,
        uint256 commitmentTime
    );

    // @notice Emitted when the market's size is updated either due to orders or liquidations.
    event MarketSizeUpdated(uint128 marketId, uint128 size, int128 skew);
}
