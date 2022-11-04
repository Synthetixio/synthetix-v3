//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../errors/AccessError.sol";

library AuthorizableStorage {
    struct Data {
        address authorized;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("Authorizable"));
        assembly {
            // bytes32(uint(keccak256("io.synthetix.authorizable")) - 1)
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
