//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/external/IRewardDistributor.sol";

import "./RewardDistributionEntry.sol";
import "./RewardDistributionStatus.sol";

/**
 * @title Used by vaults to track rewards for its participants. There will be one of these for each time a rewards distributor distributes rewards to a vault.
 */
library RewardDistribution {
    struct Data {
        /**
         * @dev The 3rd party smart contract which holds/mints tokens for distributing rewards to vault participants.
         */
        IRewardDistributor distributor;
        /**
         * @dev Information about the amount of rewards in this entry, dates, etc.
         */
        RewardDistributionEntry.Data entry;
        /**
         * @dev The value of the rewards in this entry.
         */
        uint128 rewardPerShareD18;
        /**
         * @dev The status for each actor, regarding this distribution's entry.
         */
        mapping(uint256 => RewardDistributionStatus.Data) actorInfo;
    }
}
