//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/ProxyStorage.sol";

contract Destroyer is ProxyStorage {
    function upgradeTo(address) public {
        _proxyStore().implementation = address(0);

        selfdestruct(payable(0));
    }
}
