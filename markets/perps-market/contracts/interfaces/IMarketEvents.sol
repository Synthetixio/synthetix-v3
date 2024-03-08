//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SettlementStrategy} from "../storage/SettlementStrategy.sol";

/**
 * @title Market events used on several places in the system.
 */
interface IMarketEvents {
    /**
     * @notice Gets thrown when settle order is called with invalid settlement strategy.
     */
    error SettlementStrategyNotFound(SettlementStrategy.Type strategyType);

    /**
     * @notice Gets fired when the size of a market is updated by new orders or liquidations.
     * @param marketId Id of the market used for the trade.
     * @param price Price at the time of this event.
     * @param skew Market skew at the time of the trade. Positive values mean more longs.
     * @param size Size of the entire market after settlement.
     * @param sizeDelta Change in market size during this update.
     * @param currentFundingRate The current funding rate of this market (0.001 = 0.1% per day)
     * @param currentFundingVelocity The current rate of change of the funding rate (0.001 = +0.1% per day)
     * @param interestRate Current supermarket interest rate based on updated market OI.
     */
    event MarketUpdated(
        uint128 marketId,
        uint256 price,
        int256 skew,
        uint256 size,
        int256 sizeDelta,
        int256 currentFundingRate,
        int256 currentFundingVelocity,
        uint128 interestRate
    );
}
