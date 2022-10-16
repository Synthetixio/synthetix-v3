//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

library PoolConfiguration {
    struct Data {
        uint minLiquidityRatio;
        uint preferredPool;
        SetUtil.UintSet approvedPools;
    }

    function load() internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("PoolConfiguration"));
        assembly {
            data.slot := s
        }
    }
}
