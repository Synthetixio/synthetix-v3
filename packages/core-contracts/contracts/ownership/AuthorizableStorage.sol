//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AuthorizableStorage {
    struct AuthorizableStore {
        address authorized;
    }

    function _authorizableStore() internal pure returns (AuthorizableStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.authorizable")) - 1)
            store.slot := 0x9dedc22c2235c6a81df9ead6005a4f8dd57ccea7aabae74741e05fb3542561b6
        }
    }
}
