//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/Beacon.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/BeaconProxy.sol";
import "../storage/SynthsModuleStorage.sol";

contract SynthsModule is OwnableMixin, SynthsModuleStorage {
    error BeaconAlreadyDeployed();
    error BeaconNotDeployed();
    error ImplementationNotSet();
    error SynthAlreadyDeployed();

    event BeaconDeployed(address beacon);
    event SynthDeployed(bytes32 synth, address synthProxyAddress);

    function deployBeacon() external onlyOwner {
        _deployBeacon();
    }

    function deploySynth(bytes32 synth) external onlyOwner {
        if (_synthsModuleStore().synthProxies[synth] != address(0x0)) {
            revert SynthAlreadyDeployed();
        }
        // get the Beacon address and check if it has been deployed properly and if the implementation is set.
        address beaconAddress = _synthsModuleStore().beacon;
        if (beaconAddress == address(0)) {
            revert BeaconNotDeployed();
        }
        if (Beacon(beaconAddress).getImplementation() == address(0)) {
            revert ImplementationNotSet();
        }
        // deploy a BeaconProxy with the right Beacon address
        BeaconProxy synthProxy = new BeaconProxy(beaconAddress);
        // get the proxy address
        address synthProxyAddress = address(synthProxy);
        // register the new proxy in the mapping
        _synthsModuleStore().synthProxies[synth] = synthProxyAddress;
        emit SynthDeployed(synth, synthProxyAddress);
        // TODO: initialize Synth
    }

    function upgradeSynthImplementation(address newSynthsImplementation) external onlyOwner {
        if (_synthsModuleStore().beacon != address(0)) {
            _deployBeacon();
        }
        Beacon(_synthsModuleStore().beacon).upgradeTo(newSynthsImplementation);
    }

    function getBeacon() external view returns (address) {
        return _synthsModuleStore().beacon;
    }

    function getSynthProxy(bytes32 synth) external view returns (address) {
        return _synthsModuleStore().synthProxies[synth];
    }

    function _deployBeacon() internal {
        SynthsModuleStore storage store = _synthsModuleStore();
        if (store.beacon != address(0)) {
            revert BeaconAlreadyDeployed();
        }
        address beacon = address(new Beacon(address(this)));
        store.beacon = beacon;
        emit BeaconDeployed(beacon);
    }
}
