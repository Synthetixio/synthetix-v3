//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IBasePerpMarket {
    // --- Shared Events --- //

    /// @notice Emitted when funding is computed.
    /// @param marketId Market that had their funding recomputed
    /// @param skew Current skew at the point of recomputation
    /// @param fundingVelocity Current instantaneous velocity at the point of recomputation
    event FundingRecomputed(
        uint128 indexed marketId,
        int128 skew,
        int128 fundingRate,
        int128 fundingVelocity
    );

    /// @notice Emitted when utilization is computed.
    /// @param marketId Market that had their utilization recomputed
    /// @param skew Current market skew at the point of recomputation
    /// @param utilizationRate New utilization rate after recomputation
    event UtilizationRecomputed(uint128 indexed marketId, int128 skew, uint128 utilizationRate);

    /// @notice Emitted when an order is canceled.
    /// @param accountId Account of order that was canceled
    /// @param marketId Market the order was canceled against
    /// @param keeperFee Fee paid to keeper for canceling order
    /// @param commitmentTime block.timestamp of order at the point of comment
    event OrderCanceled(
        uint128 indexed accountId,
        uint128 indexed marketId,
        uint256 keeperFee,
        uint64 commitmentTime
    );

    /// @notice Emitted when the market's size is updated either due to orders or liquidations.
    /// @param marketId Market that had their size updated
    /// @param size New market size post update
    /// @param skew New market skew post update
    event MarketSizeUpdated(uint128 indexed marketId, uint128 size, int128 skew);
}
