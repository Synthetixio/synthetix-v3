//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library PoolCrossChainInfo {
    struct Data {
        uint128 latestLiquidity;
        uint128 latestTotalWeights;
        int128 latestDebtAmount;
        uint64 latestDataTimestamp;
        uint64 lastReportedOldestDataTimestamp;

        uint64[] pairedChains;
        mapping(uint64 => uint256) pairedPoolIds;

        uint64 chainlinkSubscriptionId;
        uint32 chainlinkSubscriptionInterval;

        bytes32 latestRequestId;
    }
}