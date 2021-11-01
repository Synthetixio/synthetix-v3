//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UniversalProxyImplementation.sol";
import "../mixins/OwnerMixin.sol";
import "../storage/ProxyStorage.sol";

contract UpgradeModule is UniversalProxyImplementation, ProxyStorage, OwnerMixin {
    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    function getImplementation() public view returns (address) {
        return _getImplementation();
    }

    function _getImplementation() internal view override returns (address) {
        return _proxyStorage().implementation;
    }

    function _setImplementation(address newImplementation) internal override {
        _proxyStorage().implementation = newImplementation;
    }

    function _getSimulatingUpgrade() internal view override returns (bool) {
        return _proxyStorage().simulatingUpgrade;
    }

    function _setSimulatingUpgrade(bool simulatingUpgrade) internal override {
        _proxyStorage().simulatingUpgrade = simulatingUpgrade;
    }
}
