//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/UniversalProxyImplementation.sol";

contract UniversalProxyImplementationMockA is UniversalProxyImplementation {
    uint private _a;

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
    bool private _simulatingUpgrade;

    function setA(uint newA) external {
        _a = newA;
    }

    function getA() external view returns (uint) {
        return _a;
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

    function _setSimulatingUpgrade(bool simulatingUpgrade) internal virtual override {
        _simulatingUpgrade = simulatingUpgrade;
    }

    function _getSimulatingUpgrade() internal view override returns (bool) {
        return _simulatingUpgrade;
    }
}
