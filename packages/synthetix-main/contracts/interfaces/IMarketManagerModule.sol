//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Market Manager Module. Manages registered markets
interface IMarketManagerModule {
    event MarketRegistered(address indexed market, uint marketId);

    /// @notice registers a new market
    function registerMarket(address market) external returns (uint);

    // function setSupplyTarget(
    //     uint marketId,
    //     uint poolId,
    //     uint amount
    // ) external;

    // function supplyTarget(uint marketId) external returns (uint);

    /// @notice gets the liquidity of the market
    function marketLiquidity(uint marketId) external view returns (uint);

    /// @notice gets the USD value of the collateral backing this market.
    /// This function does not determine the market should consider available to it. Use `marketLiquidity` instaed.
    function marketCollateralValue(uint marketId) external view returns (uint);

    /// @notice gets the total balance of the market
    function marketTotalBalance(uint marketId) external view returns (int);

    function marketDebtPerShare(uint marketId) external returns (int);

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
}
