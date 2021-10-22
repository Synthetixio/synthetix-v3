//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/ForwardingProxy.sol";
import "../storage/SNXStorage.sol";

contract SNXProxy is ForwardingProxy {
    address private _owner; // owner
    address private _implementation; // upgrade
    bool private _simulatingUpgrade; // upgrade
    bool private _initialized;

    constructor(address firstImplementation) {
        _setImplementation(firstImplementation);
    }

    function _setImplementation(address newImplementation) internal override {
        _implementation = newImplementation;
    }

    function _getImplementation() internal view override returns (address) {
        return _implementation;
    }
}
