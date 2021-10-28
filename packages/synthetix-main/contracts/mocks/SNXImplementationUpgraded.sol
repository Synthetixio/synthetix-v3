//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UniversalProxyImplementation.sol";
import "./SNXStorageUpgraded.sol";

// a basic (null) implementation (shoud be an ERC20 or even ERC20 on steroids?)
contract SNXImplementationUpgraded is SNXStorageUpgraded, OwnableMixin, UniversalProxyImplementation {
    error alreadyInitialized();

    function initialize(address owner) public {
        if (_snxStorage().initialized) {
            revert alreadyInitialized();
        }
        _snxStorage().owner = owner;
        _snxStorage().initialized = true;
    }

    function _getOwner() internal view override returns (address) {
        return _snxStorage().owner;
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    function _setImplementation(address newImplementation) internal override {
        _snxStorage().implementation = newImplementation;
    }

    function _getImplementation() internal view override returns (address) {
        return _snxStorage().implementation;
    }

    function _setSimulatingUpgrade(bool simulatingUpgrade) internal virtual override {
        _snxStorage().simulatingUpgrade = simulatingUpgrade;
    }

    function _getSimulatingUpgrade() internal view override returns (bool) {
        return _snxStorage().simulatingUpgrade;
    }

    function getImplementation() public view returns (address) {
        return _getImplementation();
    }

    function setValueA(uint256 newValueA) public {
        _snxStorage().valueA = newValueA;
    }

    function getValueA() public view returns (uint256) {
        return _snxStorage().valueA;
    }
}
