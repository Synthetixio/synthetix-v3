//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SNXModuleStorage {
    struct SNXModuleNamespace {
        address snxAddress; // main address
    }

    function _snxStorage() internal pure returns (SNXModuleNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snxmodule")) - 1)
            store.slot := 0xc4dfed58c6f04372a71e422763badf66c0cd71d1750f1d38238077e763fb57d5
        }
    }
}
