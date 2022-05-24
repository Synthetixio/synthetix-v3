//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract FundTokenStorage {
    struct FundTokenStore {
        bool initialized;
        mapping(uint256 => address) nominatedOwnerOf;
    }

    function _fundTokenStore() internal pure returns (FundTokenStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.fundtoken")) - 1)
            store.slot := 0xb0a86a86929b4d86a3373df33e49224f298cd5a4ab609c54c4a944f8a2564c5a
        }
    }
}
