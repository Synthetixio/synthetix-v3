//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

library Epoch {
    struct Data {
        // Date at which the epoch started
        uint64 startDate;
        // Date at which the epoch's voting period will end
        uint64 endDate;
        // Date at which the epoch's nomination period will start
        uint64 nominationPeriodStartDate;
        // Date at which the epoch's voting period will start
        uint64 votingPeriodStartDate;
    }
}
