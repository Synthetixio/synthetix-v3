//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/ProxyStorage.sol";

contract RouterMock is ProxyStorage {
    error DelegateCallError();
    address public someModuleImp;
    address public anotherModuleImp;

    constructor(address firstSomeModuleImp, address firstAnotherModuleImp) {
        someModuleImp = firstSomeModuleImp;
        anotherModuleImp = firstAnotherModuleImp;
    }

    function setProxyAddress(address proxyImplementation) public {
        _proxyStore().implementation = proxyImplementation;
    }

    function callAnotherModule(bytes memory data) public returns (bytes memory) {
        (bool success, bytes memory result) = anotherModuleImp.delegatecall(data);

        if (!success) {
            revert DelegateCallError();
        }

        return result;
    }

    fallback() external payable {
        address implementation = someModuleImp;

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
}
