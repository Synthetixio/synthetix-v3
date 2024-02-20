//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

library ElectionSettings {
    struct Data {
        // Number of council members in the next epoch
        uint8 nextEpochSeatCount;
        // Minimum active council members. If too many are dismissed an emergency election is triggered
        uint8 minimumActiveMembers;
        // Minimum epoch duration when adjusting schedules
        uint64 minEpochDuration;
        // Minimum nomination period duration when adjusting schedules
        uint64 minNominationPeriodDuration;
        // Minimum voting period duration when adjusting schedules
        uint64 minVotingPeriodDuration;
        // Maximum size for tweaking epoch schedules (see tweakEpochSchedule)
        uint64 maxDateAdjustmentTolerance;
        // Default batch size when calling evaluate() with numBallots = 0
        uint256 defaultBallotEvaluationBatchSize;
    }
}
