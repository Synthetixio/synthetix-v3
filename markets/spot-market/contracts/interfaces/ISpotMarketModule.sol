//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

/// @title Spot Market Interface
interface ISpotMarketModule {
    error InsufficientFunds();
    error InsufficientAllowance(uint expected, uint current);

    event SynthBought(uint indexed synthMarketId, int synthReturned, uint feesCollected);
    event SynthSold(uint indexed synthMarketId, int amountReturned, uint feesCollected);

    function buy(uint128 synthMarketId, uint amountUsd) external returns (int);

    function sell(uint128 synthMarketId, uint sellAmount) external returns (int);
}
