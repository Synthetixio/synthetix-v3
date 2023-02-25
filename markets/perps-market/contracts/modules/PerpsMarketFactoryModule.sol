//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import "@synthtixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import "../utils/SynthUtil.sol";
import "../storage/PerpsMarketFactory.sol";
import "../interfaces/IPerpsMarketFactoryModule.sol";

/**
 * @title Module for registering perpetual futures markets. The factory tracks all synths in the system and consolidates implementation for all markets.
 * @dev See IPerpsMarketFactoryModule.
 */
contract PerpsMarketFactoryModule is
    IPerpsMarketFactoryModule,
    AssociatedSystemsModule,
    InitializableMixin
{
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using AssociatedSystem for AssociatedSystem.Data;

    bytes32 private constant _CREATE_MARKET_FEATURE_FLAG = "createMarket";

    function _isInitialized() internal view override returns (bool) {
        PerpsMarketFactory.Data storage PerpsMarketFactory = PerpsMarketFactory.load();
        return
            PerpsMarketFactory.synthetix != address(0) &&
            PerpsMarketFactory.usdToken != ITokenModule(address(0));
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function initialize(
        address snxAddress,
        address usdTokenAddress,
        address oracleManager,
        address initialAccountTokenImplementation
    ) external override {
        OwnableStorage.onlyOwner();
        PerpsMarketFactory.Data storage PerpsMarketFactory = PerpsMarketFactory.load();

        PerpsMarketFactory.synthetix = snxAddress;
        PerpsMarketFactory.initialAccountTokenImplementation = initialAccountTokenImplementation;
        PerpsMarketFactory.usdToken = ITokenModule(usdTokenAddress);
        PerpsMarketFactory.oracle = INodeModule(oracleManager);

        _initOrUpgradeNft(
            SynthUtil.getSystemId(perpsMarketId), // bytes32 id
            marketName,
            marketSymbol,
            "uri",
            PerpsMarketFactory.initialAccountTokenImplementation
        );
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function createMarket(
        string memory marketName,
        string memory marketSymbol,
        address synthOwner
    ) external override onlyIfInitialized returns (uint128) {
        FeatureFlag.ensureAccessToFeature(_CREATE_MARKET_FEATURE_FLAG);

        PerpsMarketFactory.Data storage PerpsMarketFactory = PerpsMarketFactory.load();
        uint128 perpsMarketId = IMarketManagerModule(PerpsMarketFactory.synthetix).registerMarket(
            address(this)
        );

        PerpsMarketFactory.marketOwners[perpsMarketId] = synthOwner;

        emit SynthRegistered(perpsMarketId);

        return perpsMarketId;
    }

    function name(uint128 marketId) external view returns (string memory) {
        string memory marketName = SynthUtil.getToken(marketId).name();
        return string.concat(marketName, " Perps Market");
    }

    function reportedDebt(uint128 marketId) external view override returns (uint256) {
        // skew
    }

    function locked(uint128 marketId) external view returns (uint256) {
        // t.b.d.
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function getSynth(uint128 marketId) external view override returns (address) {
        return address(SynthUtil.getToken(marketId));
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function upgradeSynthImpl(uint128 marketId, address synthImpl) external override {
        PerpsMarketFactory.load().onlyMarketOwner(marketId);

        bytes32 synthId = SynthUtil.getSystemId(marketId);
        _upgradeToken(synthId, synthImpl);

        emit SynthImplementationUpgraded(
            marketId,
            address(SynthUtil.getToken(marketId)),
            synthImpl
        );
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function updatePriceData(uint128 perpsMarketId, bytes32 feedId) external override {
        PerpsMarketFactory.load().onlyMarketOwner(perpsMarketId);

        Price.load(perpsMarketId).update(feedId);

        emit MarketPriceDataUpdated(perpsMarketId, feedId);
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function nominateMarketOwner(uint128 perpsMarketId, address newNominatedOwner) public override {
        PerpsMarketFactory.load().onlyMarketOwner(perpsMarketId);

        if (newNominatedOwner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        PerpsMarketFactory.load().nominatedMarketOwners[perpsMarketId] = newNominatedOwner;
        emit MarketOwnerNominated(perpsMarketId, newNominatedOwner);
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function acceptMarketOwnership(uint128 perpsMarketId) public override {
        PerpsMarketFactory.Data storage PerpsMarketFactory = PerpsMarketFactory.load();
        address currentNominatedOwner = PerpsMarketFactory.nominatedMarketOwners[perpsMarketId];
        if (msg.sender != currentNominatedOwner) {
            revert NotNominated(msg.sender);
        }

        emit MarketOwnerChanged(
            perpsMarketId,
            PerpsMarketFactory.marketOwners[perpsMarketId],
            currentNominatedOwner
        );

        PerpsMarketFactory.marketOwners[perpsMarketId] = currentNominatedOwner;
        PerpsMarketFactory.nominatedMarketOwners[perpsMarketId] = address(0);
    }

    /**
     * @inheritdoc IPerpsMarketFactoryModule
     */
    function getMarketOwner(uint128 perpsMarketId) public view override returns (address) {
        PerpsMarketFactory.Data storage PerpsMarketFactory = PerpsMarketFactory.load();
        return PerpsMarketFactory.marketOwners[perpsMarketId];
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
