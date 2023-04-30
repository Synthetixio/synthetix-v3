//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library PoolCrossChainInfo {
    struct Data {
        uint128 latestDebtAmount;
        uint64 latestDebtTimestamp;
        uint64 _unused;

        uint32[] pairedChains;
        mapping(uint32 => uint256) pairedPoolIds;
        mapping(uint32 => mapping(uint256 => uint64)) requestedPairPoolIds;

        uint64 chainlinkSubscriptionId;
        uint32 chainlinkSubscriptionInterval;

        bytes32 latestRequestId;
    }
}