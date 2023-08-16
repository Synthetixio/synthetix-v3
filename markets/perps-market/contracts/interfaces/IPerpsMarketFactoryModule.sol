//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {ISynthetixSystem} from "./external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "./external/ISpotMarketSystem.sol";

/**
 * @title Perps Market Factory module
 */
interface IPerpsMarketFactoryModule is IMarket {
    /**
     * @notice Gets fired when the factory is initialized.
     * @param globalPerpsMarketId the new global perps market id.
     */
    event FactoryInitialized(uint128 globalPerpsMarketId);

    /**
     * @notice Gets fired when a market is created.
     * @param perpsMarketId the newly created perps market id.
     * @param marketName the newly created perps market name.
     * @param marketSymbol the newly created perps market symbol.
     */
    event MarketCreated(uint128 indexed perpsMarketId, string marketName, string marketSymbol);

    /**
     * @notice Initializes the factory.
     * @dev this function should be called only once.
     * @return globalPerpsMarketId Id of the global perps market id.
     */
    function initializeFactory() external returns (uint128);

    /**
     * @notice Sets the synthetix system.
     * @param synthetix address of the main synthetix proxy.
     */
    function setSynthetix(ISynthetixSystem synthetix) external;

    /**
     * @notice Sets the spot market system.
     * @param spotMarket address of the spot market proxy.
     */
    function setSpotMarket(ISpotMarketSystem spotMarket) external;

    /**
     * @notice Creates a new market.
     * @param requestedMarketId id of the market to create.
     * @param marketName name of the market to create.
     * @param marketSymbol symbol of the market to create.
     * @return perpsMarketId Id of the created perps market.
     */
    function createMarket(
        uint128 requestedMarketId,
        string memory marketName,
        string memory marketSymbol
    ) external returns (uint128);
}
