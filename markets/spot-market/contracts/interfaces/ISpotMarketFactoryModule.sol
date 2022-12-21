//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../storage/SpotMarketFactory.sol";

/// @title Spot Market Interface
interface ISpotMarketFactoryModule is IMarket {
    event SynthRegistered(uint256 indexed synthMarketId);
    event SynthImplementationUpgraded(uint256 indexed synthMarketId);
    event SynthPriceDataUpdated(
        uint256 indexed synthMarketId,
        bytes32 buyFeedId,
        bytes32 sellFeedId
    );

    /**
     * @notice Returns wether the token has been initialized.
     * @return A boolean with the result of the query.
     */
    function isInitialized() external returns (bool);

    function initialize(
        address snxAddress,
        address usdTokenAddress,
        address oracleManager,
        address initialSynthImplementation,
        address initialAsyncOrderClaimImplementation
    ) external;

    function registerSynth(
        string memory tokenName,
        string memory tokenSymbol,
        address synthOwner
    ) external returns (uint128 synthMarketId);

    function updatePriceData(uint128 synthMarketId, bytes32 buyFeedId, bytes32 sellFeedId) external;

    function upgradeSynthImpl(uint128 marketId, address synthImpl) external;

    function upgradeAsyncOrderTokenImpl(uint128 marketId, address asyncOrderImpl) external;
}
