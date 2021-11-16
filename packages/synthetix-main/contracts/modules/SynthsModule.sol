//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/Beacon.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/BeaconProxy.sol";
import "../storage/SynthsStorage.sol";

contract SynthsModule is OwnableMixin, SynthsStorage {
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
        if (_synthsStore().synths[synth] != address(0x0)) {
            revert SynthAlreadyDeployed();
        }
        // get the Beacon address and check if it has been deployed properly and if the implementation is set.
        address beaconAddress = _synthsStore().beacon;
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
        _synthsStore().synths[synth] = synthProxyAddress;
        emit SynthDeployed(synth, synthProxyAddress);
        // TODO: initialize Synth
    }

    function upgradeSynthImplementation(address newSynthsImplementation) external onlyOwner {
        address beaconAddress = _synthsStore().beacon;
        if (beaconAddress != address(0)) {
            _deployBeacon();
        }
        Beacon(beaconAddress).upgradeTo(newSynthsImplementation);
    }

    function getBeacon() external view returns (address) {
        return _synthsStore().beacon;
    }

    function getSynthImplementation() external view returns (address) {
        return Beacon(_synthsStore().beacon).getImplementation();
    }

    function getSynth(bytes32 synth) external view returns (address) {
        return _synthsStore().synths[synth];
    }

    function _deployBeacon() internal {
        SynthsStore storage store = _synthsStore();
        if (store.beacon != address(0)) {
            revert BeaconAlreadyDeployed();
        }
        address beacon = address(new Beacon(address(this)));
        store.beacon = beacon;
        emit BeaconDeployed(beacon);
    }
}
