//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/ProxyNamespace.sol";

contract Destroyer is ProxyNamespace {
    function upgradeTo(address) public {
        _proxyStorage().implementation = address(0);

        selfdestruct(payable(0));
    }
}
