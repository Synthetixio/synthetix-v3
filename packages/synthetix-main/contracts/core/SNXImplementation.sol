//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UniversalProxyImplementation.sol";
import "../storage/SNXStorage.sol";

contract SNXImplementation is SNXStorage, OwnableMixin, UniversalProxyImplementation {
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
}
