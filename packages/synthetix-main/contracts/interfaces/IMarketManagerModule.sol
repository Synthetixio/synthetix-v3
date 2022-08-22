//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Market Manager Module. Manages registered markets
interface IMarketManagerModule {
    /// @notice registers a new market
    function registerMarket(address market) external returns (uint);

    // function setSupplyTarget(
    //     uint marketId,
    //     uint fundId,
    //     uint amount
    // ) external;

    // function supplyTarget(uint marketId) external returns (uint);

    /// @notice gets the liquidity of the market
    function marketLiquidity(uint marketId) external view returns (uint);

    /// @notice gets the total balance of the market
    function marketTotalBalance(uint marketId) external view returns (int);

    /// @notice target deposits amount of synths to the marketId
    function deposit(
        uint marketId,
        address target,
        uint amount
    ) external;

    /// @notice target withdraws amount of synths to the marketId
    function withdraw(
        uint marketId,
        address target,
        uint amount
    ) external;
}
