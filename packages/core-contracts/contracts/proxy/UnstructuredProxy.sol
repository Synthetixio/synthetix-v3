//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ForwardingProxy.sol";

contract UnstructuredProxy is ForwardingProxy {
    struct UnstructuredProxyStorage {
        address implementation;
    }

    function _getProxyStorage() internal pure returns (UnstructuredProxyStorage storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.v3.core-contracts.unstructuredproxy")) - 1)
            store.slot := 0xbfc07d3b0c02b88cba74385713df4525f83b010704ab14717e932c54e90f12f3
        }
    }

    constructor(address firstImplementation) {
        _setImplementation(firstImplementation);
    }

    function _setImplementation(address newImplementation) internal override {
        _getProxyStorage().implementation = newImplementation;
    }

    function _getImplementation() internal view override returns (address) {
        return _getProxyStorage().implementation;
    }

    function getImplementation() public view returns (address) {
        return _getImplementation();
    }
}
