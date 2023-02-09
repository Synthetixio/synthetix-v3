//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-modules/contracts/interfaces/IOwnerModule.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

import "../utils/SynthUtil.sol";
import "../storage/SpotMarketFactory.sol";
import "../interfaces/ISpotMarketFactoryModule.sol";

/**
 * @title Module for registering synths.  The factory tracks all synths in the system and consolidates implementation for all synths.
 * @dev See ISpotMarketFactoryModule.
 */
contract SpotMarketFactoryModule is
    ISpotMarketFactoryModule,
    AssociatedSystemsModule,
    InitializableMixin
{
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using AssociatedSystem for AssociatedSystem.Data;
    using Price for Price.Data;

    bytes32 private constant _CREATE_SYNTH_FEATURE_FLAG = "createSynth";

    function _isInitialized() internal view override returns (bool) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        return
            spotMarketFactory.synthetix != address(0) &&
            spotMarketFactory.usdToken != ITokenModule(address(0));
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function initialize(
        address snxAddress,
        address usdTokenAddress,
        address oracleManager,
        address initialSynthImplementation
    ) external override {
        OwnableStorage.onlyOwner();
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();

        spotMarketFactory.synthetix = snxAddress;
        spotMarketFactory.initialSynthImplementation = initialSynthImplementation;
        spotMarketFactory.usdToken = ITokenModule(usdTokenAddress);
        spotMarketFactory.oracle = INodeModule(oracleManager);
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function createSynth(
        string memory tokenName,
        string memory tokenSymbol,
        address synthOwner
    ) external override onlyIfInitialized returns (uint128) {
        FeatureFlag.ensureAccessToFeature(_CREATE_SYNTH_FEATURE_FLAG);

        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        uint128 synthMarketId = IMarketManagerModule(spotMarketFactory.synthetix).registerMarket(
            address(this)
        );

        _initOrUpgradeToken(
            SynthUtil.getSystemId(synthMarketId),
            tokenName,
            tokenSymbol,
            18,
            spotMarketFactory.initialSynthImplementation
        );

        spotMarketFactory.marketOwners[synthMarketId] = synthOwner;

        emit SynthRegistered(synthMarketId);

        return synthMarketId;
    }

    function name(uint128 marketId) external view returns (string memory) {
        string memory tokenName = SynthUtil.getToken(marketId).name();
        return string.concat(tokenName, " Spot Market");
    }

    function reportedDebt(uint128 marketId) external view override returns (uint256) {
        uint256 price = Price.getCurrentPrice(marketId, SpotMarketFactory.TransactionType.SELL);

        return SynthUtil.getToken(marketId).totalSupply().mulDecimal(price);
    }

    function locked(uint128 marketId) external view returns (uint256) {
        uint delegatedCollateral = IMarketManagerModule(SpotMarketFactory.load().synthetix)
            .getMarketCollateral(marketId);

        uint totalBalance = SynthUtil.getToken(marketId).totalSupply();
        uint totalValue = totalBalance.mulDecimal(
            Price.getCurrentPrice(marketId, SpotMarketFactory.TransactionType.BUY)
        );
        return delegatedCollateral > totalValue ? 0 : delegatedCollateral;
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
