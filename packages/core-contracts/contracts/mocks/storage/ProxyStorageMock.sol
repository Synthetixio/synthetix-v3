//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract ProxyStorageMock {
    struct ProxyStorage {
        address implementation;
    }

    function _proxyStorage() private pure returns (ProxyStorage storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.proxy")) - 1)
            store.slot := 0x9dbde58b6f7305fccdc5abd7ea1096e84de3f9ee47d83d8c3efc3e5557ac9c74
        }
    }

    function _getProxyStorageImplementation() internal view returns (address) {
        return _proxyStorage().implementation;
    }

    function _setProxyStorageImplementation(address newImplementation) internal {
        _proxyStorage().implementation = newImplementation;
    }
}
