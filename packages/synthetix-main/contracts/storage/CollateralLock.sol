//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

library CollateralLock {
    struct Data {
        uint256 amount; // adjustable (stake/unstake)
        uint64 lockExpirationTime; // adjustable (assign/unassign)
    }
}