//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/BeaconProxy.sol";

contract BeaconProxyMock is BeaconProxy {
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

    address private _beacon;

    constructor(address beacon) {
        _beacon = beacon;
    }

    function getBeacon() external view returns (address) {
        return _getBeacon();
    }

    function getImplementation() external view returns (address) {
        return _getImplementation();
    }

    function _getBeacon() internal view override returns (address) {
        return _beacon;
    }
}
