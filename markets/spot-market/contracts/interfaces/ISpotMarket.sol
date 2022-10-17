//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "../storage/SpotMarketStorage.sol";

/// @title Spot Market Interface
interface ISpotMarket is IMarket {
    event SynthRegistered(uint indexed synthMarketId);
    event SynthBought(uint indexed synthMarketId, uint synthReturned, uint feesCollected);
    event SynthSold(uint indexed synthMarketId, uint amountReturned, uint feesCollected);

    function isInitialized() external view returns (bool);

    function initialize(
        address snxAddress,
        address usdTokenAddress,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        address feeManager,
        bytes memory buyFeedId,
        bytes memory sellFeedId
    ) external;

    function updateFeeManager(address newFeeManager) external;

    function updatePriceFeed(SpotMarketStorage.PriceFeed memory priceFeed) external;

    function buy(uint amountUsd) external returns (uint);

    function sell(uint sellAmount) external returns (uint);

    function getBuyQuote(uint amountUsd) external view returns (uint, uint);

    function getSellQuote(uint amountSynth) external view returns (uint, uint);

    function getMarketId() external view returns (uint128);
}
