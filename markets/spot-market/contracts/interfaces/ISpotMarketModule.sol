//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

/// @title Spot Market Interface
interface ISpotMarketModule {
    event SynthBought(uint indexed synthMarketId, uint synthReturned, uint feesCollected);
    event SynthSold(uint indexed synthMarketId, uint amountReturned, uint feesCollected);

    function buy(uint128 synthMarketId, uint amountUsd) external returns (uint);

    function sell(uint128 synthMarketId, uint sellAmount) external returns (uint);

    function getBuyQuote(uint128 synthMarketId, uint amountUsd) external view returns (uint, uint);

    function getSellQuote(uint128 synthMarketId, uint amountSynth) external view returns (uint, uint);
}
