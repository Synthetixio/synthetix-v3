//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AbstractProxy.sol";
import "./ProxyStorage.sol";

contract UUPSProxy is AbstractProxy, ProxyStorage {
    // NOTE: It's ok to have a constructor in this case,
    // because proxies obviously won't be behing another proxy.
    constructor(address firstImplementation) {
        _setImplementation(firstImplementation);
    }

    function _setImplementation(address newImplementation) internal virtual override {
        _proxyStorage().implementation = newImplementation;
    }

    function _getImplementation() internal view virtual override returns (address) {
        return _proxyStorage().implementation;
    }
}
