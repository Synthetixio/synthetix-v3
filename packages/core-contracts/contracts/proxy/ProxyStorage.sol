//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProxyStorage {
    struct ProxyNamespace {
        address implementation;
        bool simulatingUpgrade;
    }

    function _proxyStorage() internal pure returns (ProxyNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.v3.core-contracts.proxy")) - 1)
            store.slot := 0xd3daca0a6d7491bc2d56eb9cc5d57a44c6b4ef14a20af389ba5d245f0f5b351d
        }
    }
}
