//SPDX-License-Identifier: Unlicense
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

    // we are mocking also the Ownable contract by defining the owner here
    address private _owner;
    address private _implementation;

    constructor(address firstOwner, address firstImplementation) {
        _implementation = firstImplementation;
        _owner = firstOwner;
    }

    function upgradeTo(address newImplementation) external override onlyOwner {
        _upgradeTo(newImplementation);
    }

    function _setImplementation(address newImplementation) internal override {
        _implementation = newImplementation;
    }

    function _getImplementation() internal view override returns (address) {
        return _implementation;
    }

    function _getOwner() internal view override returns (address) {
        return _owner;
    }
}
