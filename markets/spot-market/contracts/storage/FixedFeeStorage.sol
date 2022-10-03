//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

contract FixedFeeStorage {
    struct FixedFeeStore {
        address owner;
        address synthetix;
        IERC20 usdToken;
        uint fixedFee; // in bips
    }

    function _fixedFeeStore() internal pure returns (FixedFeeStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.spotMarket.fixedFee")) - 1)
            store.slot := 0x976ed865c01287df58532e354c922b8cf4f7208b3eea59e59e76f996d62f8902
        }
    }
}
