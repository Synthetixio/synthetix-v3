//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NftStorage {
    struct NftStore {
        bool initialized;
        address mainProxy;
    }

    function _nftStore() internal pure returns (NftStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.nft")) - 1)
            store.slot := 0x20ae31f985b189b5ed310833a9326bfff1af705bc23a24d3e57dbbfb14628992
        }
    }
}
