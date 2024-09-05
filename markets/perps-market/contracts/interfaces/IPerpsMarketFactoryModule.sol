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
    function initializeFactory(
        ISynthetixSystem synthetix,
        ISpotMarketSystem spotMarket,
        uint32 minDelegationTime
    ) external returns (uint128);

    /**
     * @notice Sets the perps market name.
     * @param marketName the new perps market name.
     */
    function setPerpsMarketName(string memory marketName) external;

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

    /**
     * @notice Returns the current market interest rate
     * @return rate
     */
    function interestRate() external view returns (uint128 rate);

    /**
     * @notice Returns the super market utilization rate
     * @dev The rate is the minimumCredit / delegatedCollateral available.
     * @dev Locked credit is the sum of all markets open interest * configured lockedOiRatio
     * @dev delegatedCollateral is the avaialble collateral value for markets to withdraw, delegated by LPs
     * @return rate
     * @return delegatedCollateral
     * @return lockedCredit credit locked based on OI & lockedOiRatio
     */
    function utilizationRate()
        external
        view
        returns (uint256 rate, uint256 delegatedCollateral, uint256 lockedCredit);
}
