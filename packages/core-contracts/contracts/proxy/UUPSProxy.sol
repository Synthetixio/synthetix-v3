//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AbstractProxy.sol";
import "./ProxyStorage.sol";

contract UUPSProxy is AbstractProxy, ProxyStorage {
    constructor(address firstImplementation) {
        _setImplementation(firstImplementation);
    }

    function _setImplementation(address newImplementation) internal virtual override {
        _proxyStore().implementation = newImplementation;
    }

    function _getImplementation() internal view virtual override returns (address) {
        return _proxyStore().implementation;
    }
}
