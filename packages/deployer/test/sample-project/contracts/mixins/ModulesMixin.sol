//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "../storage/ProxyStorage.sol";
import "../interfaces/IRouter.sol";


contract ModulesMixin is ProxyStorageNamespace {
    /* VIEW FUNCTIONS */

    function getModule(bytes32 moduleId) internal view returns (address) {
        return IRouter(_getImplementation()).getModule(moduleId);
    }

    function getRouter() internal view returns (address) {
        return _getImplementation();
    }
}
