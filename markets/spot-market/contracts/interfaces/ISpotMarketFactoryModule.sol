//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../storage/SpotMarketFactory.sol";

/**
 * @title Module for spot market factory
 */
interface ISpotMarketFactoryModule is IMarket {
    /**
     * @notice Thrown when an address tries to accept market ownership but has not been nominated.
     * @param addr The address that is trying to accept ownership.
     */
    error NotNominated(address addr);

    /**
     * @notice Gets fired when the synth is registered as a market.
     * @param synthMarketId Id of the synth market that was created
     */
    event SynthRegistered(uint256 indexed synthMarketId);
    /**
     * @notice Gets fired when the synth's implementation is updated on the corresponding proxy.
     * @param proxy the synth proxy servicing the latest implementation
     * @param implementation the latest implementation of the synth
     */
    event SynthImplementationUpgraded(
        uint256 indexed synthMarketId,
        address proxy,
        address implementation
    );
    /**
     * @notice Gets fired when the market's price feeds are updated, compatible with oracle manager
     * @param buyFeedId the oracle manager feed id for the buy price
     * @param sellFeedId the oracle manager feed id for the buy price
     */
    event SynthPriceDataUpdated(
        uint256 indexed synthMarketId,
        bytes32 buyFeedId,
        bytes32 sellFeedId
    );

    /**
     * @notice Emitted when an address has been nominated.
     * @param newOwner The address that has been nominated.
     * @param marketId id of the market
     */
    event OwnerNominated(address newOwner, uint128 marketId);

    /**
     * @notice Emitted when the owner of the market has changed.
     * @param oldOwner The previous owner of the market.
     * @param newOwner The new owner of the market.
     * @param marketId id of the market
     */
    event OwnerChanged(address oldOwner, address newOwner, uint128 marketId);

    /**
     * @notice Returns whether the factory has been initialized
     * @return A boolean with the result of the query.
     */
    function isInitialized() external returns (bool);

    /**
     * @notice Initializes the factory with the required dependencies.
     * @dev This function can only be called once.
     * @dev This function can only be called by the owner of the factory.
     * @dev This function can only be called if the factory is not initialized.
     * @dev The initial implementations are used as initial implementations when creating associated system.
     * @param snxAddress configured synthetix v3 core system
     * @param usdTokenAddress configured snxUSD token address
     * @param oracleManager oracle manager used for retrieving pricing data
     * @param initialSynthImplementation initial synth implementation used to initialize new synths when registering.
     * @param initialAsyncOrderClaimImplementation initial async order claim implementation.
     */
    function initialize(
        address snxAddress,
        address usdTokenAddress,
        address oracleManager,
        address initialSynthImplementation,
        address initialAsyncOrderClaimImplementation
    ) external;

    /**
     * @notice Registers a new synth market with synthetix v3 core system via market manager
     * @dev The synth is created using the initial synth implementation and creates a proxy for future upgrades of the synth implementation.
     * @dev Sets up the market owner who can update configuration for the synth.
     * @param tokenName name of synth (i.e Synthetix ETH)
     * @param tokenSymbol symbol of synth (i.e snxETH)
     * @param synthOwner owner of the market that's created.
     * @return synthMarketId id of the synth market that was created
     */
    function registerSynth(
        string memory tokenName,
        string memory tokenSymbol,
        address synthOwner
    ) external returns (uint128 synthMarketId);

    /**
     * @notice Get the proxy address of the synth for the provided marketId
     * @dev Uses associated systems module to retrieve the token address.
     * @param marketId id of the market
     * @return synthAddress address of the proxy for the synth
     */
    function getSynth(uint128 marketId) external view returns (address);

    /**
     * @notice Update the price data for a given market.
     * @dev Only the market owner can call this function.
     * @param synthMarketId id of the market
     * @param buyFeedId the oracle manager buy feed node id
     * @param sellFeedId the oracle manager sell feed node id
     */
    function updatePriceData(uint128 synthMarketId, bytes32 buyFeedId, bytes32 sellFeedId) external;

    /**
     * @notice upgrades the synth implementation for a given market.
     * @dev Only the market owner can call this function.
     * @dev The synth implementation is upgraded via the proxy.
     * @param marketId id of the market
     * @param synthImpl new synth implementation
     */
    function upgradeSynthImpl(uint128 marketId, address synthImpl) external;

    /* tbd */
    function upgradeAsyncOrderTokenImpl(uint128 marketId, address asyncOrderImpl) external;

    /**
     * @notice Allows the current market owner to nominate a new owner.
     * @dev The nominated owner will have to call `acceptOwnership` in a separate transaction in order to finalize the action and become the new contract owner.
     * @param marketId id of the market
     * @param newNominatedOwner The address that is to become nominated.
     */
    function nominateMarketOwner(uint128 marketId, address newNominatedOwner) external;

    /**
     * @notice Allows a nominated address to accept ownership of the market.
     * @dev Reverts if the caller is not nominated.
     * @param marketId id of the market
     */
    function acceptMarketOwnership(uint128 marketId) external;

    /**
     * @notice Returns market owner.
     * @param marketId id of the market
     */
    function getMarketOwner(uint128 marketId) external view returns (address);
}
