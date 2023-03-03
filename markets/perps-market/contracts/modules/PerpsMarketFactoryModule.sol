//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "../storage/PerpsMarketFactory.sol";
import "../storage/PerpsMarket.sol";
import "../storage/PerpsPrice.sol";
import "../interfaces/IPerpsMarketFactoryModule.sol";
import "../interfaces/external/ISpotMarketSystem.sol";

import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

/**
 * @title Module for registering perpetual futures markets. The factory tracks all markets in the system and consolidates implementation.
 * @dev See IPerpsMarketFactoryModule.
 */
contract PerpsMarketFactoryModule is IPerpsMarketFactoryModule {
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using AssociatedSystem for AssociatedSystem.Data;
    using PerpsPrice for PerpsPrice.Data;
    using DecimalMath for uint256;

    bytes32 private constant _CREATE_MARKET_FEATURE_FLAG = "createMarket";

    bytes32 private constant _ACCOUNT_TOKEN_SYSTEM = "accountNft";

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function setSynthetix(ISynthetixSystem synthetix) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketFactory.Data storage store = PerpsMarketFactory.load();

        store.synthetix = synthetix;
        (address usdTokenAddress, ) = synthetix.getAssociatedSystem("USDToken");
        store.usdToken = ITokenModule(usdTokenAddress);
        store.oracle = synthetix.getOracleManager();
    }

    function setSpotMarket(ISpotMarketSystem spotMarket) external override {
        OwnableStorage.onlyOwner();

        PerpsMarketFactory.load().spotMarket = spotMarket;
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function createMarket(
        string memory marketName,
        string memory marketSymbol,
        address marketOwner
    ) external override returns (uint128) {
        FeatureFlag.ensureAccessToFeature(_CREATE_MARKET_FEATURE_FLAG);

        PerpsMarketFactory.Data storage store = PerpsMarketFactory.load();
        uint128 perpsMarketId = store.synthetix.registerMarket(address(this));

        PerpsMarket.Data storage market = PerpsMarket.create(perpsMarketId);

        market.owner = marketOwner;
        market.name = marketName;
        market.symbol = marketSymbol;

        emit MarketRegistered(perpsMarketId, marketOwner, marketName, marketSymbol);

        return perpsMarketId;
    }

    function name(uint128 marketId) external view override returns (string memory) {
        return string.concat(PerpsMarket.load(marketId).name, " Perps Market");
    }

    function reportedDebt(uint128 marketId) external view override returns (uint256) {
        return MathUtil.abs(PerpsMarket.load(marketId).skew);
    }

    function locked(uint128 marketId) external view override returns (uint256) {
        return
            PerpsMarket.load(marketId).size.mulDecimal(
                MarketConfiguration.load(marketId).lockedOiPercent
            );
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function getAccountToken(uint128 marketId) external view override returns (address) {
        return AssociatedSystem.load(_ACCOUNT_TOKEN_SYSTEM).proxy;
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function updatePriceData(uint128 perpsMarketId, bytes32 feedId) external override {
        PerpsMarket.loadWithVerifiedOwner(perpsMarketId, msg.sender);

        PerpsPrice.load(perpsMarketId).update(feedId);

        emit MarketPriceDataUpdated(perpsMarketId, feedId);
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function nominateMarketOwner(
        uint128 perpsMarketId,
        address newNominatedOwner
    ) external override {
        PerpsMarket.Data storage market = PerpsMarket.loadWithVerifiedOwner(
            perpsMarketId,
            msg.sender
        );

        if (newNominatedOwner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        market.nominatedOwner = newNominatedOwner;

        emit MarketOwnerNominated(perpsMarketId, newNominatedOwner);
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function acceptMarketOwnership(uint128 perpsMarketId) external override {
        PerpsMarket.Data storage market = PerpsMarket.load(perpsMarketId);
        address currentNominatedOwner = market.nominatedOwner;
        if (msg.sender != currentNominatedOwner) {
            revert NotNominated(msg.sender);
        }

        emit MarketOwnerChanged(perpsMarketId, market.owner, currentNominatedOwner);

        market.owner = currentNominatedOwner;
        market.nominatedOwner = address(0);
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function getMarketOwner(uint128 perpsMarketId) external view override returns (address) {
        return PerpsMarket.load(perpsMarketId).owner;
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
