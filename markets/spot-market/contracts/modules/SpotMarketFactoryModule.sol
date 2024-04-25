//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {AssociatedSystemsModule, AssociatedSystem} from "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import {AddressError} from "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {IMarket} from "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {SynthUtil} from "../utils/SynthUtil.sol";
import {SpotMarketFactory} from "../storage/SpotMarketFactory.sol";
import {Price} from "../storage/Price.sol";
import {MarketConfiguration} from "../storage/MarketConfiguration.sol";
import {ISpotMarketFactoryModule} from "../interfaces/ISpotMarketFactoryModule.sol";
import {Transaction} from "../utils/TransactionUtil.sol";
import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

/**
 * @title Module for registering synths.  The factory tracks all synths in the system and consolidates implementation for all synths.
 * @dev See ISpotMarketFactoryModule.
 */
contract SpotMarketFactoryModule is ISpotMarketFactoryModule, AssociatedSystemsModule {
    using SpotMarketFactory for SpotMarketFactory.Data;
    using AssociatedSystem for AssociatedSystem.Data;
    using Price for Price.Data;
    using AssociatedSystem for AssociatedSystem.Data;
    using DecimalMath for uint256;

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

        emit SynthetixSystemSet(address(synthetix), usdTokenAddress, address(store.oracle));
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function setSynthImplementation(address synthImplementation) external override {
        OwnableStorage.onlyOwner();
        SpotMarketFactory.load().synthImplementation = synthImplementation;

        emit SynthImplementationSet(synthImplementation);
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function createSynth(
        string memory tokenName,
        string memory tokenSymbol,
        address synthOwner
    ) external override returns (uint128 synthMarketId) {
        FeatureFlag.ensureAccessToFeature(_CREATE_SYNTH_FEATURE_FLAG);

        if (synthOwner == address(0)) {
            revert InvalidMarketOwner();
        }

        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.checkSynthImplemention();

        synthMarketId = spotMarketFactory.synthetix.registerMarket(address(this));

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

        emit SynthRegistered(synthMarketId, address(SynthUtil.getToken(synthMarketId)));
    }

    /**
     * @inheritdoc IMarket
     */
    function name(uint128 marketId) external view returns (string memory marketName) {
        string memory tokenName = SynthUtil.getToken(marketId).name();
        return string.concat(tokenName, " Spot Market");
    }

    /**
     * @inheritdoc IMarket
     */
    function reportedDebt(
        uint128 marketId
    ) external view override returns (uint256 reportedDebtAmount) {
        uint256 price = Price.getCurrentPrice(
            marketId,
            Transaction.Type.SELL,
            Price.Tolerance.DEFAULT
        );

        return SynthUtil.getToken(marketId).totalSupply().mulDecimal(price);
    }

    /**
     * @inheritdoc IMarket
     * @dev locked amount is calculating by dividing total supply by the market configured collateral leverage
     * @dev collateral leverage is defaulted to 1 on registration of a new market
     */
    function minimumCredit(uint128 marketId) external view returns (uint256 lockedAmount) {
        uint256 totalBalance = SynthUtil.getToken(marketId).totalSupply();
        uint256 collateralLeverage = MarketConfiguration.load(marketId).collateralLeverage;

        return
            collateralLeverage == 0
                ? 0
                : totalBalance
                    .mulDecimal(
                        Price.getCurrentPrice(
                            marketId,
                            Transaction.Type.BUY,
                            Price.Tolerance.DEFAULT
                        )
                    )
                    .divDecimal(collateralLeverage);
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function indexPrice(
        uint128 marketId,
        uint128 transactionType,
        Price.Tolerance priceTolerance
    ) external view override returns (uint256 price) {
        Transaction.Type txnType = Transaction.loadValidTransactionType(transactionType);
        return Price.getCurrentPrice(marketId, txnType, priceTolerance);
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function getSynth(uint128 marketId) external view override returns (address synthAddress) {
        return address(SynthUtil.getToken(marketId));
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function getSynthImpl(uint128 marketId) external view returns (address implAddress) {
        return AssociatedSystem.load(SynthUtil.getSystemId(marketId)).impl;
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function upgradeSynthImpl(uint128 marketId) external override {
        address newImpl = SpotMarketFactory.load().synthImplementation;
        bytes32 synthId = SynthUtil.getSystemId(marketId);

        AssociatedSystem.Data storage associatedSystem = _upgradeToken(synthId, newImpl);

        emit SynthImplementationUpgraded(marketId, address(associatedSystem.asToken()), newImpl);
    }

    function setDecayRate(uint128 marketId, uint256 rate) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);
        SynthUtil.getToken(marketId).setDecayRate(rate);

        emit DecayRateUpdated(marketId, rate);
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function getPriceData(
        uint128 synthMarketId
    )
        external
        view
        override
        returns (bytes32 buyFeedId, bytes32 sellFeedId, uint256 strictPriceStalenessTolerance)
    {
        Price.Data storage price = Price.load(synthMarketId);
        return (price.buyFeedId, price.sellFeedId, price.strictStalenessTolerance);
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function updatePriceData(
        uint128 synthMarketId,
        bytes32 buyFeedId,
        bytes32 sellFeedId,
        uint256 strictPriceStalenessTolerance
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Price.load(synthMarketId).update(buyFeedId, sellFeedId, strictPriceStalenessTolerance);

        emit SynthPriceDataUpdated(
            synthMarketId,
            buyFeedId,
            sellFeedId,
            strictPriceStalenessTolerance
        );
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

        if (nominee != ERC2771Context._msgSender()) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        spotMarketFactory.nominatedMarketOwners[synthMarketId] = address(0);

        emit MarketNominationRenounced(synthMarketId, ERC2771Context._msgSender());
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function acceptMarketOwnership(uint128 synthMarketId) public override {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        address currentNominatedOwner = spotMarketFactory.nominatedMarketOwners[synthMarketId];
        if (ERC2771Context._msgSender() != currentNominatedOwner) {
            revert NotNominated(ERC2771Context._msgSender());
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
    function getMarketOwner(
        uint128 synthMarketId
    ) public view override returns (address marketOwner) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        return spotMarketFactory.marketOwners[synthMarketId];
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function getNominatedMarketOwner(
        uint128 synthMarketId
    ) public view override returns (address marketOwner) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        return spotMarketFactory.nominatedMarketOwners[synthMarketId];
    }

    /**
     * @inheritdoc ISpotMarketFactoryModule
     */
    function renounceMarketOwnership(uint128 synthMarketId) external override {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.onlyMarketOwner(synthMarketId);

        address currentOwner = spotMarketFactory.marketOwners[synthMarketId];
        spotMarketFactory.marketOwners[synthMarketId] = address(0);
        emit MarketOwnerChanged(synthMarketId, currentOwner, address(0));
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool isSupported) {
        return
            interfaceId == type(IMarket).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
