//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./PoolCrossChainSync.sol";

library PoolCrossChainInfo {
    struct Data {
        PoolCrossChainSync.Data latestSync;
        uint128 latestTotalWeights;

        uint64[] pairedChains;
        mapping(uint64 => uint128) pairedPoolIds;

        uint64 chainlinkSubscriptionId;
        uint32 chainlinkSubscriptionInterval;

        bytes32 latestRequestId;
    }
}