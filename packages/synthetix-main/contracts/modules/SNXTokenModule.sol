//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "../interfaces/ISNXTokenModule.sol";
import "../storage/SNXTokenStorage.sol";
import "../token/SNXToken.sol";

contract SNXTokenModule is ISNXTokenModule, OwnableMixin, SNXTokenStorage, InitializableMixin, SatelliteFactory {
    event SNXTokenCreated(address snxAddress);

    function _isInitialized() internal view override returns (bool) {
        return _snxTokenStore().initialized;
    }

    function isSNXTokenModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeSNXTokenModule() external override onlyOwner onlyIfNotInitialized {
        SNXTokenStore storage store = _snxTokenStore();

        SNXToken firstSNXTokenImplementation = new SNXToken();

        UUPSProxy snxTokenProxy = new UUPSProxy(address(firstSNXTokenImplementation));

        address snxTokenProxyAddress = address(snxTokenProxy);
        SNXToken snxToken = SNXToken(snxTokenProxyAddress);

        snxToken.nominateNewOwner(address(this));
        snxToken.acceptOwnership();
        snxToken.initialize("Synthetix Network Token", "snx", 18);

        store.snxToken = Satellite({name: "snx", contractName: "SNXToken", deployedAddress: snxTokenProxyAddress});

        store.initialized = true;

        emit SNXTokenCreated(snxTokenProxyAddress);
    }

    function _getSatellites() internal view override returns (Satellite[] memory) {
        Satellite[] memory satellites = new Satellite[](1);
        satellites[0] = _snxTokenStore().snxToken;
        return satellites;
    }

    function getSNXTokenModuleSatellites() public view override returns (Satellite[] memory) {
        return _getSatellites();
    }

    function upgradeSNXImplementation(address newSNXTokenImplementation) external override onlyOwner onlyIfInitialized {
        SNXToken(getSNXTokenAddress()).upgradeTo(newSNXTokenImplementation);
    }

    function getSNXTokenAddress() public view override returns (address) {
        return _snxTokenStore().snxToken.deployedAddress;
    }
}
