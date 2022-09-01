//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Market Manager Module
interface IMarketManagerModule {
    event MarketRegistered(address indexed market, uint indexed marketId);
    event UsdDeposited(uint indexed marketId, address indexed target, uint amount, address indexed sender);
    event UsdWithdrawn(uint indexed marketId, address indexed target, uint amount, address indexed sender);

    /// @notice registers a new market
    function registerMarket(address market) external returns (uint);

    /// @notice target deposits amount of synths to the marketId
    function depositUsd(
        uint marketId,
        address target,
        uint amount
    ) external;

    /// @notice target withdraws amount of synths to the marketId
    function withdrawUsd(
        uint marketId,
        address target,
        uint amount
    ) external;

    /// @notice gets the liquidity of the market
    function withdrawableUsd(uint marketId) external view returns (uint);

    /// @notice gets net snxUSD withdrawn - deposited by the market
    function marketIssuance(uint marketId) external view returns (int128);

    /// @notice gets the total balance of the market
    function marketReportedBalance(uint marketId) external view returns (uint);

    /// @notice gets the total balance of the market (marketIssuance + marketReportedBalance)
    function marketTotalBalance(uint marketId) external view returns (int);

    /// @notice gets the snxUSD value of the collateral backing this market.
    function marketCollateral(uint marketId) external view returns (uint);

    function marketDebtPerShare(uint marketId) external returns (int);
}
