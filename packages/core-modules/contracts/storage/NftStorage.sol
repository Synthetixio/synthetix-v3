//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NftStorage {
    struct NftStore {
        bool initialized;
        address mainProxy;
    }

    function _nftStore() internal pure returns (NftStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.nft")) - 1)
            store.slot := 0x0
        }
    }
}
