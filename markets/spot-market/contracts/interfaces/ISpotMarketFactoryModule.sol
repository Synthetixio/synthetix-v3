//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

/// @title Spot Market Interface
interface ISpotMarketFactoryModule is IMarket {
    event SynthRegistered(uint256 indexed synthMarketId);
    event SynthImplementationUpgraded(uint256 indexed synthMarketId);
    event SynthFeeDataUpdated(
        uint256 indexed synthMarketId,
        uint256 interestRate,
        uint256 fixedFee
    );
    event SynthPriceDataUpdated(uint256 indexed synthMarketId, bytes buyFeedId, bytes sellFeedId);

    function registerSynth(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address initialTokenImpl,
        address synthOwner,
        bytes memory buyFeedId,
        bytes memory sellFeedId,
        uint256 interestRate,
        uint256 fixedFee,
        bool enableWrapping,
        address wrappingCollateralType
    ) external returns (uint128 synthMarketId);

    function initialize(
        address snxAddress,
        address usdTokenAddress,
        address oracleManager
    ) external;

    function updateFeeData(
        uint128 synthMarketId,
        uint256 interestRate,
        uint256 fixedFee
    ) external;

    function updatePriceData(
        uint128 synthMarketId,
        bytes memory buyFeedId,
        bytes memory sellFeedId
    ) external;

    function upgradeSynthImpl(uint128 marketId, address synthImpl) external;
}
