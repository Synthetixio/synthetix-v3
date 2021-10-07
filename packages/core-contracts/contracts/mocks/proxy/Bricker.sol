//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../proxy/UniversalProxyImplementation.sol";

contract Bricker is UniversalProxyImplementation {
    // Missing _slot0 => all storage is offseted by one slot
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
    bool private _isUpgrading;

    address private _implementationOld;

    function upgradeTo(address newImplementation) public override {
        _implementation = newImplementation;
    }

    function _setImplementation(address newImplementation) internal override {
        _implementation = newImplementation;
    }

    function _getImplementation() internal view override returns (address) {
        return _implementation;
    }

    function _setIsUpgrading(bool isUpgrading) internal virtual override {
        _isUpgrading = isUpgrading;
    }

    function _getIsUpgrading() internal view override returns (bool) {
        return _isUpgrading;
    }
}
