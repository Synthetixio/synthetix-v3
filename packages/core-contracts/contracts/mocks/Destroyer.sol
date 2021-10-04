//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./storage/ProxyStorageMock.sol";

contract Destroyer is ProxyStorageMock {
    function upgradeTo(address) public {
        _setProxyStorageImplementation(address(0));

        selfdestruct(payable(0));
    }
}
