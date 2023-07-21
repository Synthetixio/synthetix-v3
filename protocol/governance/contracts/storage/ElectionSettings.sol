//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ElectionSettings {
    struct Data {
        // Number of council members in the current epoch
        uint8 epochSeatCount;
        // Minimum active council members. If too many are dismissed an emergency election is triggered
        uint8 minimumActiveMembers;
        // The expected duration of the epoch (used for validations in tweakEpochSchedule)
        uint64 epochDuration;
        // Minimum epoch duration when adjusting schedules
        uint64 minEpochDuration;
        // Minimum nomination period duration when adjusting schedules
        uint64 minNominationPeriodDuration;
        // Minimum voting period duration when adjusting schedules
        uint64 minVotingPeriodDuration;
        // Maximum size for tweaking epoch schedules (see tweakEpochSchedule)
        uint64 maxDateAdjustmentTolerance;
    }

    function load(uint epochIndex) internal pure returns (Data storage settings) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.ElectionSettings", epochIndex));
        assembly {
            settings.slot := s
        }
    }
}
