//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../interfaces/ISUSDTokenModule.sol";
import "../storage/SUSDTokenStorage.sol";
import "../token/SUSDToken.sol";
import "../mixins/SUSDMixin.sol";

contract SUSDTokenModule is
    ISUSDTokenModule,
    SUSDTokenStorage,
    SUSDMixin,
    OwnableMixin,
    InitializableMixin,
    SatelliteFactory
{
    event SUSDTokenCreated(address snxAddress);

    function _isInitialized() internal view override returns (bool) {
        return _sUSDInitialized();
    }

    function isSUSDTokenModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeSUSDTokenModule() external override onlyOwner onlyIfNotInitialized {
        SUSDTokenStore storage store = _sUSDTokenStore();

        SUSDToken firstSUSDTokenImplementation = new SUSDToken();

        UUPSProxy sUSDTokenProxy = new UUPSProxy(address(firstSUSDTokenImplementation));

        address sUSDTokenProxyAddress = address(sUSDTokenProxy);
        SUSDToken sUSDToken = SUSDToken(sUSDTokenProxyAddress);

        sUSDToken.nominateNewOwner(address(this));
        sUSDToken.acceptOwnership();
        sUSDToken.initialize("Synthetic USD Token v3", "sUSD", 18);

        store.sUSDToken = Satellite({name: "sUSD", contractName: "SUSDToken", deployedAddress: sUSDTokenProxyAddress});

        store.initialized = true;

        emit SUSDTokenCreated(sUSDTokenProxyAddress);
    }

    function _getSatellites() internal view override returns (Satellite[] memory) {
        Satellite[] memory satellites = new Satellite[](1);
        satellites[0] = _sUSDTokenStore().sUSDToken;
        return satellites;
    }

    function getSUSDTokenModuleSatellites() public view override returns (Satellite[] memory) {
        return _getSatellites();
    }

    function upgradeSUSDImplementation(address newSUSDTokenImplementation) external override onlyOwner onlyIfInitialized {
        SUSDToken(getSUSDTokenAddress()).upgradeTo(newSUSDTokenImplementation);
    }

    function getSUSDTokenAddress() public view override returns (address) {
        return _getSUSDTokenAddress();
    }
}
