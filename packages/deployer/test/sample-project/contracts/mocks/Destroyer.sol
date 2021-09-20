//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/ProxyNamespace.sol";


contract Destroyer is ProxyNamespace {
    modifier postExecutor() {
        _;
        selfdestruct(payable(0));
    }

    function upgradeTo(address) public postExecutor {
        _proxyStorage().implementation = address(0);
    }
}
