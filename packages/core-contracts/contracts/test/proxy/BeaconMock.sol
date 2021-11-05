//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/Beacon.sol";

contract BeaconMock is Beacon {
    bytes32 private _slot0;
    bytes32 private _slot1;
    bytes32 private _slot2;
    bytes32 private _slot3;
    bytes32 private _slot4;
    bytes32 private _slot5;
    bytes32 private _slot6;
    bytes32 private _slot7;
    bytes32 private _slot8;
    bytes32 private _slot9;

    address private _implementation;

    constructor(address firstImplementation) {
        _implementation = firstImplementation;
    }

    function upgradeTo(address newImplementation) external {
        _upgradeTo(newImplementation);
    }

    function _setImplementation(address newImplementation) internal override {
        _implementation = newImplementation;
    }

    function _getImplementation() internal view override returns (address) {
        return _implementation;
    }
}
