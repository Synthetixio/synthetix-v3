//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMarketManagerModule {
    /// initiates the struct
    function registerMarket(address market) external returns (uint);

    function setSupplyTarget(
        uint marketId,
        uint fundId,
        uint amount
    ) external;

    function supplyTarget(uint marketId) external returns (uint);

    function liquidity(uint marketId) external view returns (uint);

    function fundBalance(uint marketId, uint fundId) external view returns (int);

    function totalBalance(uint marketId) external view returns (int);

    function deposit(
        uint marketId,
        address target,
        uint amount
    ) external;

    function withdraw(
        uint marketId,
        address target,
        uint amount
    ) external;
}
