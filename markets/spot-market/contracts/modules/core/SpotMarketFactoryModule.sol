//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-modules/contracts/interfaces/IOwnerModule.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/IOracleManagerModule.sol";
import "../../utils/SynthUtil.sol";
import "../../storage/SpotMarketFactory.sol";
import "../../storage/Price.sol";
import "../../interfaces/ISpotMarketFactoryModule.sol";

contract SpotMarketFactoryModule is
    ISpotMarketFactoryModule,
    AssociatedSystemsModule,
    InitializableMixin
{
    using MathUtil for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using AssociatedSystem for AssociatedSystem.Data;

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
        address oracleManager
    ) external override {
        OwnableStorage.onlyOwner();
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        store.synthetix = snxAddress;
        store.usdToken = ITokenModule(usdTokenAddress);
        store.oracle = IOracleManagerModule(oracleManager);
    }

    function registerSynth(
        string memory tokenName,
        string memory tokenSymbol,
        // required for adding upgrade/owner modules and creating proxy for synth
        address initialTokenImpl,
        address synthOwner,
        Price.Data memory priceData,
        Fee.Data memory feeData,
        Wrapper.Data memory wrapperData
    ) external override returns (uint128) {
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        uint128 synthMarketId = IMarketManagerModule(factory.synthetix).registerMarket(
            address(this)
        );

        _initOrUpgradeToken(
            SynthUtil.getSystemId(synthMarketId),
            tokenName,
            tokenSymbol,
            18,
            initialTokenImpl
        );

        factory.synthConfigs[synthMarketId] = SynthConfig.Data({
            priceData: priceData,
            feeData: feeData,
            wrapperData: wrapperData,
            owner: synthOwner,
            marketId: synthMarketId
        });

        emit SynthRegistered(synthMarketId);

        return synthMarketId;
    }

    function name(uint128 marketId) external view returns (string memory) {
        return "Spot Market";
    }

    function reportedDebt(uint128 marketId) external view override returns (uint256) {
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();

        uint256 price = factory.getCurrentPrice(marketId);

        return SynthUtil.getToken(marketId).totalSupply().mulDecimal(price);
    }

    function locked(uint128 marketId) external view returns (uint256) {
        return 0;
    }

    function upgradeSynthImpl(uint128 marketId, address synthImpl) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);

        bytes32 synthId = SynthUtil.getSystemId(marketId);
        _upgradeToken(synthId, synthImpl);
    }

    function updateFeeData(
        uint128 synthMarketId,
        uint256 interestRate,
        uint256 fixedFee
    ) external override {
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        factory.onlyMarketOwner(synthMarketId);

        factory.synthConfigs[synthMarketId].feeData = Fee.Data({
            interestRate: interestRate,
            fixedFee: fixedFee
        });

        emit SynthFeeDataUpdated(synthMarketId, interestRate, fixedFee);
    }

    function updatePriceData(
        uint128 synthMarketId,
        bytes memory buyFeedId,
        bytes memory sellFeedId
    ) external override {
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        factory.onlyMarketOwner(synthMarketId);

        factory.synthConfigs[synthMarketId].priceData = Price.Data({
            buyFeedId: buyFeedId,
            sellFeedId: sellFeedId
        });

        emit SynthPriceDataUpdated(synthMarketId, buyFeedId, sellFeedId);
    }
}
