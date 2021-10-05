//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../mixins/OwnerMixin.sol";
import "../storage/ProxyNamespace.sol";
import "@synthetixio/core-contracts/contracts/proxy/UniversalProxyImplementation.sol";

contract UpgradeModule is UniversalProxyImplementation, ProxyNamespace, OwnerMixin {
    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    function _getImplementation() internal view override returns (address) {
        return _proxyStorage().implementation;
    }

    function _setImplementation(address newImplementation) internal override {
        _proxyStorage().implementation = newImplementation;
    }
}
