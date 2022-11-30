//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library RewardDistributionStatus {
    struct Data {
        uint128 lastRewardPerShareD18;
        uint128 pendingSendD18;
    }
}
