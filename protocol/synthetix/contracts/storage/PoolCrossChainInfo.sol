//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

struct PoolCrossChainSync {
    uint128 liquidity;
    int128 cumulativeMarketDebt;
    int128 totalDebt;
    uint64 dataTimestamp;
    uint64 oldestDataTimestamp;
}

library PoolCrossChainInfo {
    struct Data {
        PoolCrossChainSync latestSync;
        uint128 latestTotalWeights;

        uint64[] pairedChains;
        mapping(uint64 => uint128) pairedPoolIds;

        uint64 chainlinkSubscriptionId;
        uint32 chainlinkSubscriptionInterval;

        bytes32 latestRequestId;
    }
}