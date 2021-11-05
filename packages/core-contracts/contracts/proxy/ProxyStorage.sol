//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProxyStorage {
    struct ProxyNamespace {
        address implementation;
        bool simulatingUpgrade;
    }

    function _proxyStorage() internal pure returns (ProxyNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.v3.proxy")) - 1)
            store.slot := 0x32402780481dd8149e50baad867f01da72e2f7d02639a6fe378dbd80b6bb446e
        }
    }
}
