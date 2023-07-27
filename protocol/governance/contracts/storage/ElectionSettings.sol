//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ElectionSettings {
    struct Data {
        // Implementation proposed by previous Council to which can be upgraded to (see UpgradeProposalModule)
        address proposedImplementation;
        // Number of council members in the current epoch
        uint8 epochSeatCount;
        // Minimum active council members. If too many are dismissed an emergency election is triggered
        uint8 minimumActiveMembers;
        // Expected duration of the epoch
        uint64 epochDuration;
        // Expected nomination period duration
        uint64 nominationPeriodDuration;
        // Expected voting period duration
        uint64 votingPeriodDuration;
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
