//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import "@synthetixio/core-modules/contracts/interfaces/IOwnerModule.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../utils/SynthUtil.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/Price.sol";
import "../interfaces/ISpotMarketFactoryModule.sol";
import "../synth/Synth.sol";

contract SpotMarketFactoryModule is ISpotMarketFactoryModule, AssociatedSystemsModule, InitializableMixin {
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

    function initialize(address snxAddress, address usdTokenAddress) external override {
        OwnableStorage.onlyOwner();
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        store.synthetix = snxAddress;
        store.usdToken = ITokenModule(usdTokenAddress);
    }

    function registerSynth(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        address feeManager,
        bytes memory buyFeedId,
        bytes memory sellFeedId
    ) external override returns (uint128) {
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        uint128 synthMarketId = IMarketManagerModule(factory.synthetix).registerMarket(address(this));

        bytes32 synthId = SynthUtil.getSystemId(synthMarketId);
        initOrUpgradeToken(synthId, tokenName, tokenSymbol, tokenDecimals, address(new Synth()));

        factory.synthConfigs[synthMarketId] = SynthConfig.Data({
            priceData: Price.Data({buyFeedId: buyFeedId, sellFeedId: sellFeedId}),
            feeData: Fee.Data({interestRate: 0, fixedFee: 20}),
            synthOwner: msg.sender,
            feeManager: feeManager,
            marketId: synthMarketId
        });

        emit SynthRegistered(synthMarketId);

        return synthMarketId;
    }

    function name(uint128 marketId) external view returns (string memory) {
        return "Spot Market";
    }

    function reportedDebt(uint128 marketId) external view override returns (uint) {
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();

        uint price = factory.getCurrentPrice(marketId);

        return SynthUtil.getToken(marketId).totalSupply().mulDecimal(price);
    }
}
