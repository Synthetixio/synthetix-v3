//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../interfaces/IUSDTokenModule.sol";
import "../storage/USDTokenStorage.sol";
import "../token/USDToken.sol";
import "../mixins/USDMixin.sol";

contract USDTokenModule is IUSDTokenModule, USDTokenStorage, USDMixin, OwnableMixin, InitializableMixin, SatelliteFactory {
    event USDTokenCreated(address snxAddress);

    function _isInitialized() internal view override returns (bool) {
        return _usdTokenInitialized();
    }

    function isUSDTokenModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeUSDTokenModule() external override onlyOwner onlyIfNotInitialized {
        USDTokenStore storage store = _USDTokenStore();

        USDToken firstUSDTokenImplementation = new USDToken();

        UUPSProxy usdTokenProxy = new UUPSProxy(address(firstUSDTokenImplementation));

        address usdTokenProxyAddress = address(usdTokenProxy);
        USDToken usdToken = USDToken(usdTokenProxyAddress);

        usdToken.nominateNewOwner(address(this));
        usdToken.acceptOwnership();
        usdToken.initialize("Synthetic USD Token v3", "USD", 18);

        store.usdToken = Satellite({name: "USD", contractName: "usdToken", deployedAddress: usdTokenProxyAddress});

        store.initialized = true;

        emit USDTokenCreated(usdTokenProxyAddress);
    }

    function _getSatellites() internal view override returns (Satellite[] memory) {
        Satellite[] memory satellites = new Satellite[](1);
        satellites[0] = _USDTokenStore().usdToken;
        return satellites;
    }

    function getUSDTokenModuleSatellites() public view override returns (Satellite[] memory) {
        return _getSatellites();
    }

    function upgradeUSDImplementation(address newUSDTokenImplementation) external override onlyOwner onlyIfInitialized {
        USDToken(getUSDTokenAddress()).upgradeTo(newUSDTokenImplementation);
    }

    function getUSDTokenAddress() public view override returns (address) {
        return _getUSDTokenAddress();
    }
}
