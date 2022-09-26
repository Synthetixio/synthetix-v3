//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library DistributionActor {
    struct Data {
        uint128 shares;
        int128 lastValuePerShare;
    }
}
