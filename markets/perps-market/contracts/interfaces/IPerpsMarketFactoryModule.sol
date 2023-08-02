//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {ISynthetixSystem} from "./external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "./external/ISpotMarketSystem.sol";

interface IPerpsMarketFactoryModule is IMarket {
    event FactoryInitialized(uint128 globalPerpsMarketId);
    event MarketCreated(uint128 indexed perpsMarketId, string marketName, string marketSymbol);

    function initializeFactory() external returns (uint128);

    function setSynthetix(ISynthetixSystem synthetix) external;

    function setSpotMarket(ISpotMarketSystem spotMarket) external;

    function createMarket(
        uint128 requestedMarketId,
        string memory marketName,
        string memory marketSymbol
    ) external returns (uint128);
}
