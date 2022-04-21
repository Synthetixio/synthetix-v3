//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FundModuleStorage {
    struct FundModuleStore {
        bool initialized;
    }

    function _fundModuleStore() internal pure returns (FundModuleStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundmodule")) - 1)
            store.slot := 0x777921625cac3385fe90fd55ec5b9c58ada192ff82f029c62116f9fddf316bcd
        }
    }
}
