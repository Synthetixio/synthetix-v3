//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/ForwardingProxy.sol";

contract ForwardingProxyMock is ForwardingProxy {
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
        _setImplementation(firstImplementation);
    }

    function setImplementation(address newImplementation) external {
        _setImplementation(newImplementation);
    }

    function getImplementation() external view returns (address) {
        return _getImplementation();
    }

    function _setImplementation(address newImplementation) internal override {
        _implementation = newImplementation;
    }

    function _getImplementation() internal view override returns (address) {
        return _implementation;
    }
}
