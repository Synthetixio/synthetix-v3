//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IBeacon.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/BeaconProxy.sol";
import "../storage/SynthsModuleStorage.sol";

contract SynthsModule is OwnableMixin, SynthsModuleStorage {
    error SynthExists();

    event NewSynthDeployed(bytes32 synth, address synthProxyAddress);

    function deployNewSynth(bytes32 synth) external onlyOwner {
        if (_synthsModuleStore().synthProxies[synth] != address(0x0)) {
            revert SynthExists();
        }
        // deploy a BeaconProxy with the right Beacon address
        address beaconAddress = _synthsModuleStore().beacon;
        // TODO: check if beacon is not set?
        BeaconProxy synthProxy = new BeaconProxy(beaconAddress);
        // get the proxy address
        address synthProxyAddress = address(synthProxy);
        // register the new proxy in the mapping
        _synthsModuleStore().synthProxies[synth] = synthProxyAddress;
        emit NewSynthDeployed(synth, synthProxyAddress);
    }

    function upgradeSynthImplementation(address newSynthsImplementation) external onlyOwner {
        IBeacon(_synthsModuleStore().beacon).upgradeTo(newSynthsImplementation);
    }

    function getSynthProxy(bytes32 synth) external view returns (address) {
        return _synthsModuleStore().synthProxies[synth];
    }
}
