//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProxyStorage {
    struct ProxyNamespace {
        address implementation;
    }

    function _getProxyStorage() internal pure returns (ProxyNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.v3.core-contracts.proxy")) - 1)
            store.slot := 0xd3daca0a6d7491bc2d56eb9cc5d57a44c6b4ef14a20af389ba5d245f0f5b351d
        }
    }
}

contract ForwardingProxy is ProxyStorage {
    fallback() external payable {
        _forward();
    }

    receive() external payable {
        _forward();
    }

    function _forward() internal {
        address implementation = _getImplementation();

        // solhint-disable-next-line no-inline-assembly
        assembly {
            calldatacopy(0, 0, calldatasize())

            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)

            returndatacopy(0, 0, returndatasize())

            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    function _setImplementation(address newImplementation) internal virtual {
        _getProxyStorage().implementation = newImplementation;
    }

    function _getImplementation() internal virtual view returns (address) {
        return _getProxyStorage().implementation;
    }
}
