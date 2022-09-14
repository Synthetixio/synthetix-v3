//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RewardDistributorStorage {
    struct RewardDistributorStore {
        mapping(uint => uint) allocatedPools;
    }

    function _rewardDistributorStore() internal pure returns (RewardDistributorStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.rewarddistributor")) - 1)
            store.slot := 0x42d0aef1b2d83e58380b501fb363a1c8204c1b822c89813d23bcefcf422595af
        }
    }
}
