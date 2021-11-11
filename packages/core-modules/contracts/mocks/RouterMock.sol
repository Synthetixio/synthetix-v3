//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";

contract RouterMock is UUPSProxy {
    error DelegateCallError();

    address public anotherModuleImp;

    constructor(address firstSomeModuleImp, address firstAnotherModuleImp) UUPSProxy(firstSomeModuleImp) {
        anotherModuleImp = firstAnotherModuleImp;
    }

    function callAnotherModule(bytes memory data) public returns (bytes memory) {
        (bool success, bytes memory result) = anotherModuleImp.delegatecall(data);

        if (!success) {
            revert DelegateCallError();
        }

        return result;
    }
}
