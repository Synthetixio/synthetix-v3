//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import "../utils/SynthUtil.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/MarketConfiguration.sol";
import "../interfaces/ISpotMarketFactoryModule.sol";

/**
 * @title Module for registering synths.  The factory tracks all synths in the system and consolidates implementation for all synths.
 * @dev See ISpotMarketFactoryModule.
 */
contract SpotMarketFactoryModule is ISpotMarketFactoryModule, AssociatedSystemsModule {
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using AssociatedSystem for AssociatedSystem.Data;
    using MarketConfiguration for MarketConfiguration.Data;
    using Price for Price.Data;

    bytes32 private constant _CREATE_SYNTH_FEATURE_FLAG = "createSynth";
    uint8 private constant _SYNTH_IMPLEMENTATION_DECIMALS = 18;

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function setSynthetix(ISynthetixSystem synthetix) external override {
        OwnableStorage.onlyOwner();
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        store.synthetix = synthetix;
        (address usdTokenAddress, ) = synthetix.getAssociatedSystem("USDToken");
        store.usdToken = ITokenModule(usdTokenAddress);
        store.oracle = synthetix.getOracleManager();
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function setSynthImplementation(address synthImplementation) external override {
        OwnableStorage.onlyOwner();
        SpotMarketFactory.load().synthImplementation = synthImplementation;
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function createSynth(
        string memory tokenName,
        string memory tokenSymbol,
        address synthOwner
    ) external override returns (uint128) {
        FeatureFlag.ensureAccessToFeature(_CREATE_SYNTH_FEATURE_FLAG);

        if (synthOwner == address(0)) {
            revert InvalidMarketOwner();
        }

        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.checkSynthImplemention();

        uint128 synthMarketId = spotMarketFactory.synthetix.registerMarket(address(this));

        _initOrUpgradeToken(
            SynthUtil.getSystemId(synthMarketId),
            tokenName,
            tokenSymbol,
            _SYNTH_IMPLEMENTATION_DECIMALS,
            spotMarketFactory.synthImplementation
        );

        spotMarketFactory.marketOwners[synthMarketId] = synthOwner;
        // default collateral leverage to 1
        MarketConfiguration.load(synthMarketId).collateralLeverage = DecimalMath.UNIT;

        emit SynthRegistered(synthMarketId);

        return synthMarketId;
    }

    function name(uint128 marketId) external view returns (string memory) {
        string memory tokenName = SynthUtil.getToken(marketId).name();
        return string.concat(tokenName, " Spot Market");
    }

    function reportedDebt(uint128 marketId) external view override returns (uint256) {
        uint256 price = Price.getCurrentPrice(marketId, Transaction.Type.SELL);

        return SynthUtil.getToken(marketId).totalSupply().mulDecimal(price);
    }

    /**
     * @dev locked amount is calculating by dividing total supply by the market configured collateral leverage
     * @dev collateral leverage is defaulted to 1 on registration of a new market
     */
    function locked(uint128 marketId) external view returns (uint256) {
        uint totalBalance = SynthUtil.getToken(marketId).totalSupply();
        uint collateralLeverage = MarketConfiguration.load(marketId).collateralLeverage;

        return
            collateralLeverage == 0
                ? 0
                : totalBalance
                    .mulDecimal(Price.getCurrentPrice(marketId, Transaction.Type.BUY))
                    .divDecimal(collateralLeverage);
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function getSynth(uint128 marketId) external view override returns (address) {
        return address(SynthUtil.getToken(marketId));
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function upgradeSynthImpl(uint128 marketId, address synthImpl) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);

        bytes32 synthId = SynthUtil.getSystemId(marketId);
        _upgradeToken(synthId, synthImpl);

        emit SynthImplementationUpgraded(
            marketId,
            address(SynthUtil.getToken(marketId)),
            synthImpl
        );
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function updatePriceData(
        uint128 synthMarketId,
        bytes32 buyFeedId,
        bytes32 sellFeedId
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Price.load(synthMarketId).update(buyFeedId, sellFeedId);

        emit SynthPriceDataUpdated(synthMarketId, buyFeedId, sellFeedId);
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function nominateMarketOwner(uint128 synthMarketId, address newNominatedOwner) public override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        if (newNominatedOwner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        SpotMarketFactory.load().nominatedMarketOwners[synthMarketId] = newNominatedOwner;
        emit MarketOwnerNominated(synthMarketId, newNominatedOwner);
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function renounceMarketNomination(uint128 synthMarketId) external override {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        address nominee = spotMarketFactory.nominatedMarketOwners[synthMarketId];

        if (nominee != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        spotMarketFactory.nominatedMarketOwners[synthMarketId] = address(0);

        emit MarketNominationRenounced(synthMarketId, msg.sender);
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function acceptMarketOwnership(uint128 synthMarketId) public override {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        address currentNominatedOwner = spotMarketFactory.nominatedMarketOwners[synthMarketId];
        if (msg.sender != currentNominatedOwner) {
            revert NotNominated(msg.sender);
        }

        emit MarketOwnerChanged(
            synthMarketId,
            spotMarketFactory.marketOwners[synthMarketId],
            currentNominatedOwner
        );

        spotMarketFactory.marketOwners[synthMarketId] = currentNominatedOwner;
        spotMarketFactory.nominatedMarketOwners[synthMarketId] = address(0);
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function getMarketOwner(uint128 synthMarketId) public view override returns (address) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        return spotMarketFactory.marketOwners[synthMarketId];
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IMarket).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
