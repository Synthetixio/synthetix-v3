//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

interface IBasePerpMarket {
    // --- Shared Events --- //

    // @notice Emitted when funding is computed.
    event FundingRecomputed(uint128 marketId, int256 skew, int256 fundingRate, int256 fundingVelocity);

    // @notice Emitted when an order is canceled.
    event OrderCanceled(uint128 accountId, uint128 marketId, uint256 keeperFee, uint256 commitmentTime);
}
