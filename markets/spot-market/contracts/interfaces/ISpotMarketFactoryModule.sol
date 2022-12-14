//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../storage/SpotMarketFactory.sol";

/// @title Spot Market Interface
interface ISpotMarketFactoryModule is IMarket {
    event SynthRegistered(uint256 indexed synthMarketId);
    event SynthImplementationUpgraded(uint256 indexed synthMarketId);
    event SynthFeeDataUpdated(uint256 indexed synthMarketId, Fee.Data feeData);
    event SynthPriceDataUpdated(uint256 indexed synthMarketId, Price.Data feeData);

    function initialize(
        address snxAddress,
        address usdTokenAddress,
        address oracleManager,
        address initialSynthImplementation
    ) external;

    function registerSynth(
        string memory tokenName,
        string memory tokenSymbol,
        address synthOwner,
        Price.Data memory priceData,
        Fee.Data memory feeData,
        Wrapper.Data memory wrapperData
    ) external returns (uint128 synthMarketId);

    function updateFeeData(uint128 synthMarketId, Fee.Data memory) external;

    function updatePriceData(uint128 synthMarketId, Price.Data memory) external;

    function upgradeSynthImpl(uint128 marketId, address synthImpl) external;
}
