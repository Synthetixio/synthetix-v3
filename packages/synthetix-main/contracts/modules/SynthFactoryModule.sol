//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/mocks/proxy/BeaconProxyMock.sol";
import "@synthetixio/core-modules/contracts/mixins/OwnerMixin.sol";
import "@synthetixio/core-modules/contracts/modules/BeaconModule.sol";
import "../storage/SynthFactoryModuleStorage.sol";

contract SynthFactoryModule is OwnerMixin, BeaconModule, SynthFactoryModuleStorage {
    error SynthExists();

    event NewSynthDeployed(bytes32 synth, address synthProxyAddress);

    function deployNewSynth(bytes32 synth) external onlyOwner {
        if (_synthFactoryStorage().synthProxies[synth] != address(0x0)) {
            revert SynthExists();
        }
        // deploy a BeaconProxy, the beacon address is the current contract
        BeaconProxy synthProxy = new BeaconProxyMock(address(this));
        // get the proxy address
        address synthProxyAddress = address(synthProxy);
        // register the new proxy in the mapping
        _synthFactoryStorage().synthProxies[synth] = synthProxyAddress;
        emit NewSynthDeployed(synth, synthProxyAddress);
    }

    function upgradeSynthImplementation(address newSynthsImplementation) external onlyOwner {
        _upgradeTo(newSynthsImplementation);
    }

    function getSynthProxy(bytes32 synth) external view returns (address) {
        return _synthFactoryStorage().synthProxies[synth];
    }
}
