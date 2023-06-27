//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {ISynthetixSystem} from "./external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "./external/ISpotMarketSystem.sol";

interface IPerpsMarketFactoryModule is IMarket {
    event FactoryInitialized(uint128 globalPerpsMarketId);
    event MarketCreated(
        uint128 indexed perpsMarketId,
        address indexed marketOwner,
        string marketName,
        string marketSymbol
    );

    event OwnerNominated(address indexed newNominatedOwner);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    event MarketPriceDataUpdated(uint128 indexed perpsMarketId, bytes32 feedId);

    error NotNominated(address notNominatedAddress);

    function initializeFactory() external returns (uint128);

    function setSynthetix(ISynthetixSystem synthetix) external;

    function setSpotMarket(ISpotMarketSystem spotMarket) external;

    function createMarket(
        uint128 requestedMarketId,
        string memory marketName,
        string memory marketSymbol,
        address marketOwner
    ) external returns (uint128);

    function updatePriceData(uint128 perpsMarketId, bytes32 feedId) external;

    function nominateOwner(address newNominatedOwner) external;

    function acceptOwnership() external;
}
