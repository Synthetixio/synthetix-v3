//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UniversalProxyImplementation.sol";
import "../../contracts/storage/SNXStorage.sol";

// a basic (null) implementation (shoud be an ERC20 or even ERC20 on steroids?)
contract SNXImplementationUpdated is OwnableMixin, UniversalProxyImplementation {
    address private _owner;
    address private _implementation;
    bool private _simulatingUpgrade;
    bool private _initialized;

    uint256 private _valueA;

    function setValueA(uint256 newValueA) public {
        _valueA = newValueA;
    }

    function getValueA() public view returns (uint256) {
        return _valueA;
    }

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

    function getImplementation() public view returns (address) {
        return _getImplementation();
    }
}
