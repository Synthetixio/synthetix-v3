//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProxyStorage {
    struct ProxyNamespace {
        address implementation;
        bool simulatingUpgrade;
    }

    function _proxyStorage() internal pure returns (ProxyNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.proxy")) - 1)
            store.slot := 0x9dbde58b6f7305fccdc5abd7ea1096e84de3f9ee47d83d8c3efc3e5557ac9c74
        }
    }
}
