//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/external/IRewardDistributor.sol";

import "./DistributionEntry.sol";
import "./RewardDistributionStatus.sol";

library RewardDistribution {
    struct Data {
        // 3rd party smart contract which holds/mints the pools
        IRewardDistributor distributor;
        DistributionEntry.Data entry;
        uint128 rewardPerShare;
        mapping(uint256 => RewardDistributionStatus.Data) actorInfo;
    }
}
