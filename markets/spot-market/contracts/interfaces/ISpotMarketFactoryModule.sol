//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

/// @title Spot Market Interface
interface ISpotMarketFactoryModule is IMarket {
    event SynthRegistered(uint indexed synthMarketId);

    function registerSynth(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        address feeManager,
        bytes memory buyFeedId,
        bytes memory sellFeedId
    ) external returns (uint128 synthMarketId);

    function updateSynthConfiguration(
        uint128 synthMarketId,
        address feeManager,
        bytes memory buyFeedId,
        bytes memory sellFeedId
    ) external;

    function initialize(address snxAddress, address usdTokenAddress) external;
}
