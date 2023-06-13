//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {ISynthetixSystem} from "./external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "./external/ISpotMarketSystem.sol";

interface IPerpsMarketFactoryModule is IMarket {
    event MarketRegistered(
        uint128 indexed perpsMarketId,
        address indexed marketOwner,
        string marketName,
        string marketSymbol
    );
    event MarketOwnerNominated(uint128 indexed perpsMarketId, address newNominatedOwner);
    event MarketOwnerChanged(uint128 indexed perpsMarketId, address oldOwner, address newOwner);
    event MarketPriceDataUpdated(uint128 indexed perpsMarketId, bytes32 feedId);

    error NotNominated(address notNominatedAddress);

    function setSynthetix(ISynthetixSystem synthetix) external;

    function setSpotMarket(ISpotMarketSystem spotMarket) external;

    function createMarket(
        string memory marketName,
        string memory marketSymbol,
        address marketOwner
    ) external returns (uint128);

    function symbol(uint128 marketId) external view returns (string memory);

    function updatePriceData(uint128 perpsMarketId, bytes32 feedId) external;

    function nominateMarketOwner(uint128 perpsMarketId, address newNominatedOwner) external;

    function acceptMarketOwnership(uint128 perpsMarketId) external;

    function getMarketOwner(uint128 perpsMarketId) external view returns (address);
}
