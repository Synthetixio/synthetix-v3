//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

abstract contract ForwardingProxy {
    constructor(address firstImplementation) {
        _setImplementation(firstImplementation);
    }

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

    function _setImplementation(address newImplementation) internal virtual;

    function _getImplementation() internal virtual view returns (address);
}

