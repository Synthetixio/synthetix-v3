//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/external/IRewardDistributor.sol";

import "./RewardDistributionEntry.sol";
import "./RewardDistributionStatus.sol";

library RewardDistribution {
    struct Data {
        // 3rd party smart contract which holds/mints the pools
        IRewardDistributor distributor;
        RewardDistributionEntry.Data entry;
        uint128 rewardPerShareD18;
        mapping(uint256 => RewardDistributionStatus.Data) actorInfo;
    }
}
