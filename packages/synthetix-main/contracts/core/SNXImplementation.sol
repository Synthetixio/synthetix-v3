//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UniversalProxyImplementation.sol";

contract SNXImplementation is OwnableMixin, UniversalProxyImplementation {
    address private _owner;
    address private _implementation;
    bool private _simulatingUpgrade;
    bool private _initialized;

    error alreadyInitialized();

    function initialize(address owner) public {
        if (_initialized) {
            revert alreadyInitialized();
        }
        _owner = owner;
        _initialized = true;
    }

    function _getOwner() internal view override returns (address) {
        return _owner;
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
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
