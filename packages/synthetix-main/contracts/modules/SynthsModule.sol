//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/Beacon.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/BeaconProxy.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "../interfaces/ISynthsModule.sol";
import "../interfaces/ISynth.sol";
import "../storage/SynthsStorage.sol";
import "../token/Synth.sol";

contract SynthsModule is ISynthsModule, OwnableMixin, SynthsStorage, InitializableMixin {
    event BeaconCreated(address beacon);
    event SynthImplementationCreated(address implementationAddress);
    event SynthCreated(bytes32 synth, address synthAddress);

    error ImplementationNotSet();
    error SynthAlreadyCreated();

    function _isInitialized() internal view override returns (bool) {
        return _synthsStore().initialized;
    }

    function isSynthsModuleInitialized() external view override returns (bool) {
        return _isInitialized();
    }

    function initializeSynthsModule() external override onlyOwner onlyIfNotInitialized {
        SynthsStore storage store = _synthsStore();

        address beacon = address(new Beacon(address(this)));
        store.beacon = beacon;

        store.initialized = true;

        emit BeaconCreated(beacon);
    }

    function createSynth(
        bytes32 synth,
        string memory synthName,
        string memory synthSymbol,
        uint8 synthDecimals
    ) external override onlyOwner onlyIfInitialized {
        if (_synthsStore().synths[synth] != address(0x0)) {
            revert SynthAlreadyCreated();
        }

        address beaconAddress = _synthsStore().beacon;

        if (Beacon(beaconAddress).getImplementation() == address(0)) {
            revert ImplementationNotSet();
        }

        address synthAddress = address(new BeaconProxy(beaconAddress));

        _synthsStore().synths[synth] = synthAddress;

        ISynth(synthAddress).initialize(synthName, synthSymbol, synthDecimals);

        emit SynthCreated(synth, synthAddress);
    }

    function upgradeSynthImplementation(address newSynthsImplementation) external override onlyOwner onlyIfInitialized {
        address beaconAddress = _synthsStore().beacon;

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
