//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../storage/SettlementStrategy.sol";

/**
 * @title Module for updating configuration in relation to async order modules.
 */
interface IAsyncOrderConfigurationModule {
    /**
     * @notice Gets fired when new settlement strategy is added.
     * @param synthMarketId adds settlement strategy to this specific market.
     * @param strategyId the newly created settlement strategy id.
     */
    event SettlementStrategyAdded(uint128 synthMarketId, uint256 strategyId);

    /**
     * @notice Gets fired when settlement strategy is enabled/disabled.
     * @dev currently only enabled/disabled flag can be updated.
     * @param synthMarketId adds settlement strategy to this specific market.
     * @param strategyId id of the strategy.
     * @param enabled true/false.
     */
    event SettlementStrategyUpdated(uint128 synthMarketId, uint256 strategyId, bool enabled);

    /**
     * @notice Adds new settlement strategy to the specified market id.
     * @param synthMarketId Id of the market to associate the strategy with.
     * @param strategy Settlement strategy data. see SettlementStrategy.Data struct.
     * @return strategyId newly created settlement strategy id.
     */
    function addSettlementStrategy(
        uint128 synthMarketId,
        SettlementStrategy.Data memory strategy
    ) external returns (uint256 strategyId);

    /**
     * @notice Sets the strategy to enabled or disabled.
     * @dev when disabled, the strategy will be invalid for committing of new async orders.
     * @param synthMarketId Id of the market associated with the strategy.
     * @param strategyId id of the strategy.
     * @param enabled set enabled/disabled.
     */
    function setSettlementStrategyEnabled(
        uint128 synthMarketId,
        uint256 strategyId,
        bool enabled
    ) external;

    /**
     * @notice Returns the settlement strategy data for given market/strategy id.
     * @param marketId Id of the market associated with the strategy.
     * @param strategyId id of the strategy.
     * @return SettlementStrategy.Data
     */
    function getSettlementStrategy(
        uint128 marketId,
        uint256 strategyId
    ) external view returns (SettlementStrategy.Data memory);
}
