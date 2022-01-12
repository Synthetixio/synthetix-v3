//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/Beacon.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/satellite/SatelliteFactory.sol";
import "@synthetixio/core-contracts/contracts/proxy/BeaconProxy.sol";
import "../interfaces/ISynthsModule.sol";
import "../interfaces/ISynth.sol";
import "../storage/SynthsStorage.sol";
import "../token/Synth.sol";

contract SynthsModule is ISynthsModule, OwnableMixin, SynthsStorage, SatelliteFactory {
    event BeaconCreated(address beacon);
    event SynthImplementationCreated(address implementationAddress);
    event SynthCreated(bytes32 synth, address synthAddress);

    error BeaconAlreadyCreated();
    error BeaconNotCreated();
    error ImplementationNotSet();
    error SynthAlreadyCreated();

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

        address beaconAddress = _synthsStore().beacon;
        if (beaconAddress == address(0)) {
            revert BeaconNotCreated();
        }

        if (Beacon(beaconAddress).getImplementation() == address(0)) {
            revert ImplementationNotSet();
        }

        address synthAddress = address(new BeaconProxy(beaconAddress));

        _synthsStore().synths[synth] = synthAddress;

        ISynth(synthAddress).initialize(synthName, synthSymbol, synthDecimals);

        emit SatelliteCreated("contracts/token/Synth.sol:Synth", synthAddress);
        emit SynthCreated(synth, synthAddress);
    }

    function upgradeSynthImplementation(address newSynthsImplementation) external override onlyOwner {
        address beaconAddress = _synthsStore().beacon;

        if (beaconAddress == address(0)) {
            revert BeaconNotCreated();
        }

        Beacon(beaconAddress).upgradeTo(newSynthsImplementation);
    }

    function createSynthImplementation() external override {
        address implementationAddress = address(new Synth());

        emit SynthImplementationCreated(implementationAddress);
    }

    function getBeacon() external view override returns (address) {
        return _synthsStore().beacon;
    }

    function getSynthImplementation() external view override returns (address) {
        return Beacon(_synthsStore().beacon).getImplementation();
    }

    function getSynth(bytes32 synth) external view override returns (address) {
        return _synthsStore().synths[synth];
    }
}
