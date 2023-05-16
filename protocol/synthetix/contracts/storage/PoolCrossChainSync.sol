//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library PoolCrossChainSync {
    struct Data {
        uint128 liquidity;
        int128 cumulativeMarketDebt;
        int128 totalDebt;
        uint64 dataTimestamp;
        uint64 oldestDataTimestamp;
        uint64 oldestPoolConfigTimestamp;
    }
}
