//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

/// @title Spot Market Interface
interface ISpotMarket is IMarket {
    function registerSynth(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address priceFeed,
        address feeManager
    ) external returns (uint);

    function getMarket(uint marketId) external view returns (address);

    function getSynthPrice(uint marketId) external pure returns (uint);

    function buy(uint marketId, uint amountUsd) external;

    function sell(uint marketId, uint sellAmount) external;
}
