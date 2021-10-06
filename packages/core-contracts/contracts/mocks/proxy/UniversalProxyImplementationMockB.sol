//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../proxy/UniversalProxyImplementation.sol";

contract UniversalProxyImplementationMockB is UniversalProxyImplementation {
    uint private _a;
    bytes32 private _b;

    bytes32 private _slot2;
    bytes32 private _slot3;
    bytes32 private _slot4;
    bytes32 private _slot5;
    bytes32 private _slot6;
    bytes32 private _slot7;
    bytes32 private _slot8;
    bytes32 private _slot9;

    address private _implementation;

    function setA(uint newA) external payable {
        _a = newA;
    }

    function getA() external view returns (uint) {
        return _a;
    }

    function setB(bytes32 newB) external {
        _b = newB;
    }

    function getB() external view returns (bytes32) {
        return _b;
    }

    function upgradeTo(address newImplementation) public override {
        _upgradeTo(newImplementation);
    }

    function _setImplementation(address newImplementation) internal override {
        _implementation = newImplementation;
    }

    function _getImplementation() internal view override returns (address) {
        return _implementation;
    }
}
