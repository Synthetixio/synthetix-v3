//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./storage/ProxyNamespace.sol";

contract MainProxy is ProxyNamespace {
    fallback() external payable virtual {
        address impl = _proxyStorage().implementation;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            calldatacopy(0, 0, calldatasize())

            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)

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

    constructor(address firstImplementation) payable {
        _proxyStorage().implementation = firstImplementation;
    }
}
