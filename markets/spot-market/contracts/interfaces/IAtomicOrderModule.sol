//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

/// @title Spot Market Interface
interface IAtomicOrderModule {
    error InsufficientFunds();
    error InsufficientAllowance(uint expected, uint current);

    event SynthBought(uint indexed synthMarketId, uint synthReturned, int feesCollected);
    event SynthSold(uint indexed synthMarketId, uint amountReturned, int feesCollected);

    function buy(uint128 synthMarketId, uint amountUsd) external returns (uint);

    function sell(uint128 synthMarketId, uint sellAmount) external returns (uint);
}
