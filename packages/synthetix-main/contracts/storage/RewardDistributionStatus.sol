//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library RewardDistributionStatus {
    struct Data {
        uint128 lastRewardPerShare;
        uint128 pendingSend;
    }
}
