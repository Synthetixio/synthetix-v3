//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library SnapshotVotePowerEpoch {
    struct Data {
        uint128 snapshotId;
        uint128 createdAt;
        mapping(address => uint256) recordedVotingPower;
    }
}
