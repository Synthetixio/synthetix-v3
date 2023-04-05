//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "./external/ISynthetixSystem.sol";

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
     * @notice Thrown when createSynth is called with zero-address synth owner
     */
    error InvalidMarketOwner();

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
        address indexed proxy,
        address implementation
    );
    /**
     * @notice Gets fired when the market's price feeds are updated, compatible with oracle manager
     * @param buyFeedId the oracle manager feed id for the buy price
     * @param sellFeedId the oracle manager feed id for the buy price
     */
    event SynthPriceDataUpdated(
        uint256 indexed synthMarketId,
        bytes32 indexed buyFeedId,
        bytes32 indexed sellFeedId
    );

    /**
     * @notice Emitted when an address has been nominated.
     * @param marketId id of the market
     * @param newOwner The address that has been nominated.
     */
    event MarketOwnerNominated(uint128 indexed marketId, address newOwner);

    /**
     * @notice Emitted when market nominee renounces nomination.
     * @param marketId id of the market
     * @param nominee The address that has been nominated.
     */
    event MarketNominationRenounced(uint128 indexed marketId, address nominee);

    /**
     * @notice Emitted when the owner of the market has changed.
     * @param marketId id of the market
     * @param oldOwner The previous owner of the market.
     * @param newOwner The new owner of the market.
     */
    event MarketOwnerChanged(uint128 indexed marketId, address oldOwner, address newOwner);

    /**
     * @notice Sets the v3 synthetix core system.
     * @dev Pulls in the USDToken and oracle manager from the synthetix core system and sets those appropriately.
     * @param synthetix synthetix v3 core system address
     */
    function setSynthetix(ISynthetixSystem synthetix) external;

    /**
     * @notice When a new synth is created, this is the erc20 implementation that is used.
     * @param synthImplementation erc20 implementation address
     */
    function setSynthImplementation(address synthImplementation) external;

    /**
     * @notice Creates a new synth market with synthetix v3 core system via market manager
     * @dev The synth is created using the initial synth implementation and creates a proxy for future upgrades of the synth implementation.
     * @dev Sets up the market owner who can update configuration for the synth.
     * @param tokenName name of synth (i.e Synthetix ETH)
     * @param tokenSymbol symbol of synth (i.e snxETH)
     * @param synthOwner owner of the market that's created.
     * @return synthMarketId id of the synth market that was created
     */
    function createSynth(
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
     * @param marketId id of the market
     * @param buyFeedId the oracle manager buy feed node id
     * @param sellFeedId the oracle manager sell feed node id
     */
    function updatePriceData(uint128 marketId, bytes32 buyFeedId, bytes32 sellFeedId) external;

    /**
     * @notice upgrades the synth implementation for a given market.
     * @dev Only the market owner can call this function.
     * @dev The synth implementation is upgraded via the proxy.
     * @param marketId id of the market
     * @param synthImpl new synth implementation
     */
    function upgradeSynthImpl(uint128 marketId, address synthImpl) external;

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
     * @notice Allows a nominated address to renounce ownership of the market.
     * @dev Reverts if the caller is not nominated.
     * @param marketId id of the market
     */
    function renounceMarketNomination(uint128 marketId) external;

    /**
     * @notice Returns market owner.
     * @param marketId id of the market
     */
    function getMarketOwner(uint128 marketId) external view returns (address);
}
