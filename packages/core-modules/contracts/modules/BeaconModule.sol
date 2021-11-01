//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/BeaconStorage.sol";
import "@synthetixio/core-contracts/contracts/proxy/Beacon.sol";

contract BeaconModule is Beacon, BeaconStorage {
    function _setImplementation(address newImplementation) internal override {
        _beaconStorage().implementation = newImplementation;
    }

    function _getImplementation() internal view override returns (address) {
        return _beaconStorage().implementation;
    }
}
