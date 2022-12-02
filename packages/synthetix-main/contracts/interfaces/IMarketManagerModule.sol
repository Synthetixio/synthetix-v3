//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Market Manager Module
interface IMarketManagerModule {
    event MarketRegistered(address indexed market, uint128 indexed marketId);
    event MarketUsdDeposited(uint128 indexed marketId, address indexed target, uint amount, address indexed sender);
    event MarketUsdWithdrawn(uint128 indexed marketId, address indexed target, uint amount, address indexed sender);

    /// @notice registers a new market
    function registerMarket(address market) external returns (uint128);

    /// @notice target deposits amount of synths to the marketId
    function depositMarketUsd(
        uint128 marketId,
        address target,
        uint amount
    ) external;

    /// @notice target withdraws amount of synths to the marketId
    function withdrawMarketUsd(
        uint128 marketId,
        address target,
        uint amount
    ) external;

    /// @notice gets the liquidity of the market
    function getWithdrawableUsd(uint128 marketId) external view returns (uint);

    /// @notice gets net snxUSD withdrawn - deposited by the market
    function getMarketNetIssuance(uint128 marketId) external view returns (int128);

    /// @notice gets the total balance of the market
    function getMarketReportedDebt(uint128 marketId) external view returns (uint);

    /// @notice gets the total balance of the market (marketIssuance + marketReportedDebt)
    function getMarketTotalBalance(uint128 marketId) external view returns (int);

    /// @notice gets the snxUSD value of the collateral backing this market.
    function getMarketCollateral(uint128 marketId) external view returns (uint);

    function getMarketDebtPerShare(uint128 marketId) external returns (int);

    function isMarketCapacityLocked(uint128 marketId) external view returns (bool);
}
