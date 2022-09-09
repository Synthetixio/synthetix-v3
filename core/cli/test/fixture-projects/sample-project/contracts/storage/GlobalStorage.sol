//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GlobalStorage {
    struct GlobalStore {
        uint uintValue;
        address[] addressArray;
    }

    function _globalStore() internal pure returns (GlobalStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.global")) - 1)
            store.slot := 0x8f203f5ee9f9a1d361b4a0f56abfdac49cdd246db58538b151edf87309e955b9
        }
    }
}
