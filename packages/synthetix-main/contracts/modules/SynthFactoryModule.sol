//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/mocks/proxy/BeaconProxyMock.sol";
import "@synthetixio/core-modules/contracts/mixins/OwnerMixin.sol";
import "@synthetixio/core-modules/contracts/modules/BeaconModule.sol";
import "../storage/SynthFactoryModuleStorage.sol";

contract SynthFactoryModule is OwnerMixin, BeaconModule, SynthFactoryModuleStorage {
    error SynthExists();

    event NewSynthDeployed(bytes32 synth);

    function deployNewSynth(bytes32 synth) external onlyOwner {
        if (_synthFactoryStorage().synthProxies[synth] != address(0x0)) {
            revert SynthExists();
        }
        // deploy a BeaconProxy, the beacon address is the current contract
        BeaconProxy synthProxy = new BeaconProxyMock(address(this));
        // register the new proxy in the mapping
        _synthFactoryStorage().synthProxies[synth] = address(synthProxy);
        emit NewSynthDeployed(synth);
    }

    function upgradeSynthImplementation(address newSynthsImplementation) external onlyOwner {
        _upgradeTo(newSynthsImplementation);
    }
}
