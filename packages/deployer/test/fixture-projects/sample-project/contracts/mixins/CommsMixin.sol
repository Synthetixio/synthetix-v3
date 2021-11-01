//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/storage/ProxyStorage.sol";

contract CommsMixin is ProxyStorage {
    error IntermoduleCallFailed();

    function _intermoduleCall(bytes memory data) internal returns (bytes memory) {
        address router = _proxyStorage().implementation;

        (bool success, bytes memory result) = router.delegatecall(data);

        if (!success) {
            revert IntermoduleCallFailed();
        }

        return result;
    }
}
