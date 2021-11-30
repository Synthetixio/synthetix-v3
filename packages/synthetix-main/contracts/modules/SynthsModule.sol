//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/Beacon.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/BeaconProxy.sol";
import "../interfaces/ISynthsModule.sol";
import "../interfaces/ISynth.sol";
import "../storage/SynthsStorage.sol";

contract SynthsModule is ISynthsModule, OwnableMixin, SynthsStorage {
    function createBeacon() external override onlyOwner {
        SynthsStore storage store = _synthsStore();
        if (store.beacon != address(0)) {
            revert BeaconAlreadyCreated();
        }
        address beacon = address(new Beacon(address(this)));
        store.beacon = beacon;
        emit BeaconCreated(beacon);
    }

    function createSynth(
        bytes32 synth,
        string memory synthName,
        string memory synthSymbol,
        uint8 synthDecimals
    ) external override onlyOwner {
        if (_synthsStore().synths[synth] != address(0x0)) {
            revert SynthAlreadyCreated();
        }
        // get the Beacon address and check if it has been deployed properly and if the implementation is set.
        address beaconAddress = _synthsStore().beacon;
        if (beaconAddress == address(0)) {
            revert BeaconNotCreated();
        }
        if (Beacon(beaconAddress).getImplementation() == address(0)) {
            revert ImplementationNotSet();
        }
        // deploy a BeaconProxy/Synth with the right Beacon address
        address synthAddress = address(new BeaconProxy(beaconAddress));
        // register the new synth (proxy) in the mapping
        _synthsStore().synths[synth] = synthAddress;
        emit SynthCreated(synth, synthAddress);
        // initialize synth
        ISynth(synthAddress).initialize(synthName, synthSymbol, synthDecimals);
    }

    function upgradeSynthImplementation(address newSynthsImplementation) external override onlyOwner {
        address beaconAddress = _synthsStore().beacon;
        if (beaconAddress == address(0)) {
            revert BeaconNotCreated();
        }
        Beacon(beaconAddress).upgradeTo(newSynthsImplementation);
    }

    function getBeacon() external override view returns (address) {
        return _synthsStore().beacon;
    }

    function getSynthImplementation() external override view returns (address) {
        return Beacon(_synthsStore().beacon).getImplementation();
    }

    function getSynth(bytes32 synth) external override view returns (address) {
        return _synthsStore().synths[synth];
    }
}
