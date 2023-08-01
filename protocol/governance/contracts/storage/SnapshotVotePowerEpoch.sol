//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library SnapshotVotePowerEpoch {
    struct Data {
				uint256 snapshotId;
				mapping(address => uint256) recordedVotingPower;
    }
}
