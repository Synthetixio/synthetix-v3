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

contract SynthsModule is ISynthsModule, OwnableMixin, SynthsStorage, SatellitesFactory {
    event BeaconCreated(address beacon);
    event SynthImplementationCreated(address implementationAddress);
    event SynthCreated(bytes32 synth, address synthAddress);

    error BeaconAlreadyCreated();
    error BeaconNotCreated();
    error ImplementationNotSet();
    error SynthAlreadyCreated();

    function _getSatellites() internal view override returns (Satellite[] memory) {
        SynthsStore storage store = _synthsStore();
        Satellite[] memory satellites = new Satellite[](store.synthsIds.length);

        for (uint256 i = 0; i < store.synthsIds.length; i++) {
            satellites[i] = store.synths[store.synthsIds[i]];
        }

        return satellites;
    }

    function getSynthsModuleSatellites() public view returns (Satellite[] memory) {
        return _getSatellites();
    }

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
        if (_synthsStore().synths[synth].deployedAddress != address(0)) {
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

        _synthsStore().synths[synth] = Satellite({
            id: synth,
            contractName: type(ISynth).name,
            deployedAddress: synthAddress
        });

        _synthsStore().synthsIds.push(synth);

        ISynth(synthAddress).initialize(synthName, synthSymbol, synthDecimals);

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
        return _synthsStore().synths[synth].deployedAddress;
    }
}
