//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract PoolConfigurationStorage {
    struct PoolConfigurationStore {
        uint preferredPool;
        SetUtil.UintSet approvedPools;
    }

    function _poolConfigurationStore() internal pure returns (PoolConfigurationStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.poolconfiguration")) - 1)
            store.slot := 0xb8adeb43e9d46c86884aee3feb6064c199bae59704ba5a5030f8530e2e23ec5e
        }
    }
}
