//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/ProxyStorage.sol";

contract CommsMixin is ProxyStorage {
    error IntermoduleCallFailed();

    function _intermoduleCall(bytes memory data) internal returns (bytes memory) {
        address router = _proxyStore().implementation;

        (bool success, bytes memory result) = router.delegatecall(data);

        if (!success) {
            revert IntermoduleCallFailed();
        }

        return result;
    }
}
