// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// @custom:artifact contracts/storage/GlobalStorage.sol:GlobalStorage
contract GlobalStorage {
    struct GlobalStore {
        uint value;
        uint someValue;
    }
    function _globalStore() internal pure returns (GlobalStore storage store) {
        assembly {
            store.slot := 0x8f203f5ee9f9a1d361b4a0f56abfdac49cdd246db58538b151edf87309e955b9
        }
    }
}
