//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UniversalProxyImplementation.sol";
import "@synthetixio/core-modules/contracts/mixins/OwnerMixin.sol";
import "@synthetixio/core-modules/contracts/storage/ProxyStorage.sol";

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
