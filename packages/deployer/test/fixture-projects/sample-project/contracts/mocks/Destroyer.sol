//SPDX-License-Identifier: UnlicMITense
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/storage/ProxyStorage.sol";

contract Destroyer is ProxyStorage {
    function upgradeTo(address) public {
        _proxyStorage().implementation = address(0);

        selfdestruct(payable(0));
    }
}
