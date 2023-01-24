//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../errors/AccessError.sol";

library AuthorizableStorage {
    bytes32 private constant _SLOT_AUTHORIZABLE_STORAGE =
        keccak256(abi.encode("io.synthetix.synthetix.Authorizable"));

    struct Data {
        address authorized;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_AUTHORIZABLE_STORAGE;
        assembly {
            store.slot := s
        }
    }

    function onlyAuthorized() internal view {
        if (msg.sender != getAuthorized()) {
            revert AccessError.Unauthorized(msg.sender);
        }
    }

    function getAuthorized() internal view returns (address) {
        return AuthorizableStorage.load().authorized;
    }
}
