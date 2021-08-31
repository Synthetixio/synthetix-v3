//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/ProxyNamespace.sol";

contract ModulesMixin is ProxyNamespace {
    /* VIEW FUNCTIONS */

    function _getRouter() internal view returns (address) {
        return _getImplementation();
    }
}