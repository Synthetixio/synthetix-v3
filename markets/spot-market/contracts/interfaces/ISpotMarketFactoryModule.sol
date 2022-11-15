//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

/// @title Spot Market Interface
interface ISpotMarketFactoryModule is IMarket {
    event SynthRegistered(uint indexed synthMarketId);

    function registerSynth(
        address synthImpl,
        address synthOwner,
        bytes memory buyFeedId,
        bytes memory sellFeedId,
        uint interestRate,
        uint fixedFee,
        bool enableWrapping,
        address wrappingCollateralType
    ) external returns (uint128 synthMarketId);

    function initialize(address snxAddress, address usdTokenAddress) external;

    function updateFeeData(
        uint128 synthMarketId,
        uint interestRate,
        uint fixedFee
    ) external;

    function updatePriceData(
        uint128 synthMarketId,
        bytes memory buyFeedId,
        bytes memory sellFeedId
    ) external;

    function upgradeSynthImpl(uint128 marketId, address synthImpl) external;
}
