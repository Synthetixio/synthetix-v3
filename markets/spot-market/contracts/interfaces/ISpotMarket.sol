//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "../storage/SpotMarketStorage.sol";

/// @title Spot Market Interface
interface ISpotMarket is IMarket {
    event SynthRegistered(uint indexed synthMarketId);
    event SynthBought(uint indexed synthMarketId, uint synthReturned, uint feesCollected);
    event SynthSold(uint indexed synthMarketId, uint amountReturned, uint feesCollected);
    event SynthExchanged(uint indexed fromMarketId, uint indexed toMarketId, uint amountReturned, uint feesCollected);

    function setExternalSystems(address snxAddress, address usdTokenAddress) external;

    function registerSynth(
        address synth,
        address priceFeed,
        address feeManager
    ) external returns (uint);

    function getMarket(uint marketId) external view returns (SpotMarketStorage.MarketSynth memory);

    function getSynthPrice(uint marketId) external pure returns (uint);

    function updateFeeManager(uint marketId, address newFeeManager) external;

    function buy(uint marketId, uint amountUsd) external returns (uint);

    function sell(uint marketId, uint sellAmount) external returns (uint);

    function exchange(
        uint fromMarketId,
        uint toMarketId,
        uint amount
    ) external returns (uint);
}
