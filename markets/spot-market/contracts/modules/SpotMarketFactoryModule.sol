//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-modules/contracts/interfaces/IOwnerModule.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/IOracleManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "../utils/SynthUtil.sol";
import "../utils/AsyncOrderClaimTokenUtil.sol";
import "../storage/SpotMarketFactory.sol";
import "../interfaces/ISpotMarketFactoryModule.sol";

contract SpotMarketFactoryModule is
    ISpotMarketFactoryModule,
    AssociatedSystemsModule,
    InitializableMixin
{
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using AssociatedSystem for AssociatedSystem.Data;
    using Price for Price.Data;

    function _isInitialized() internal view override returns (bool) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        return store.synthetix != address(0) && store.usdToken != ITokenModule(address(0));
    }

    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    // specify oracle manager address
    function initialize(
        address snxAddress,
        address usdTokenAddress,
        address oracleManager,
        address initialSynthImplementation,
        address initialAsyncOrderClaimImplementation
    ) external override {
        OwnableStorage.onlyOwner();
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        store.synthetix = snxAddress;
        store.initialSynthImplementation = initialSynthImplementation;
        store.initialAsyncOrderClaimImplementation = initialAsyncOrderClaimImplementation;
        store.usdToken = ITokenModule(usdTokenAddress);
        store.oracle = IOracleManagerModule(oracleManager);
    }

    function registerSynth(
        string memory tokenName,
        string memory tokenSymbol,
        address synthOwner
    ) external override onlyIfInitialized returns (uint128) {
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        uint128 synthMarketId = IMarketManagerModule(factory.synthetix).registerMarket(
            address(this)
        );

        _initOrUpgradeToken(
            SynthUtil.getSystemId(synthMarketId),
            tokenName,
            tokenSymbol,
            18,
            factory.initialSynthImplementation
        );

        _initOrUpgradeNft(
            AsyncOrderClaimTokenUtil.getSystemId(synthMarketId),
            tokenName,
            tokenSymbol,
            "",
            factory.initialAsyncOrderClaimImplementation
        );

        factory.synthOwners[synthMarketId] = synthOwner;

        emit SynthRegistered(synthMarketId);

        return synthMarketId;
    }

    function name(uint128 marketId) external view returns (string memory) {
        return "Spot Market";
    }

    function reportedDebt(uint128 marketId) external view override returns (uint256) {
        uint256 price = Price.getCurrentPrice(marketId, SpotMarketFactory.TransactionType.BUY);

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

    function upgradeSynthImpl(uint128 marketId, address synthImpl) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);

        bytes32 synthId = SynthUtil.getSystemId(marketId);
        _upgradeToken(synthId, synthImpl);
    }

    function upgradeAsyncOrderTokenImpl(
        uint128 marketId,
        address asyncOrderImpl
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);

        bytes32 asyncOrderClaimTokenId = AsyncOrderClaimTokenUtil.getSystemId(marketId);
        _upgradeNft(asyncOrderClaimTokenId, asyncOrderImpl);
    }

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
