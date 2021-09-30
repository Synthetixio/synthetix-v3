//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/ProxyNamespace.sol";

contract CommsMixin is ProxyNamespace {
    function _intermoduleCall(bytes memory data) internal returns (bytes memory) {
        address router = _proxyStorage().implementation;

        (bool success, bytes memory result) = router.delegatecall(data);

        require(success, "Intermodule call failed");

        return result;
    }
}
