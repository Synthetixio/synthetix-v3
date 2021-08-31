//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./storage/ProxyNamespace.sol";

contract MainProxy is ProxyNamespace {
    function _fallback(address implementation) internal virtual {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            calldatacopy(0, 0, calldatasize())

            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)

            returndatacopy(0, 0, returndatasize())

            switch result

            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    fallback () external payable virtual {
        _fallback(_getImplementation());
    }

    receive () external payable virtual {
        _fallback(_getImplementation());
    }

    constructor(address firstImplementation) payable {
        _setImplementation(firstImplementation);
    }
}
