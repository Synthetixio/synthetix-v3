//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------
// GENERATED CODE - do not edit manually!!
// run npx hardhat generate-testable to regenerate
// --------------------------------------------------------------------------------
// --------------------------------------------------------------------------------

import { ElectionSettings } from "../../storage/ElectionSettings.sol";

contract TestableElectionSettingsStorage {
    function _getInstanceStore() internal pure returns (ElectionSettings.Data storage data) {
        bytes32 s = keccak256(abi.encode("TestableElectionSettings"));
        assembly {
            data.slot := s
        }
    }

    function ElectionSettings_set_nextEpochSeatCount(uint8 val) external {
        ElectionSettings.Data storage store = _getInstanceStore();
        store.nextEpochSeatCount = val;
    }

    function ElectionSettings_get_nextEpochSeatCount() external view returns (uint8) {
        ElectionSettings.Data storage store = _getInstanceStore();
        return store.nextEpochSeatCount;
    }

    function ElectionSettings_set_minimumActiveMembers(uint8 val) external {
        ElectionSettings.Data storage store = _getInstanceStore();
        store.minimumActiveMembers = val;
    }

    function ElectionSettings_get_minimumActiveMembers() external view returns (uint8) {
        ElectionSettings.Data storage store = _getInstanceStore();
        return store.minimumActiveMembers;
    }

    function ElectionSettings_set_minEpochDuration(uint64 val) external {
        ElectionSettings.Data storage store = _getInstanceStore();
        store.minEpochDuration = val;
    }

    function ElectionSettings_get_minEpochDuration() external view returns (uint64) {
        ElectionSettings.Data storage store = _getInstanceStore();
        return store.minEpochDuration;
    }

    function ElectionSettings_set_minNominationPeriodDuration(uint64 val) external {
        ElectionSettings.Data storage store = _getInstanceStore();
        store.minNominationPeriodDuration = val;
    }

    function ElectionSettings_get_minNominationPeriodDuration() external view returns (uint64) {
        ElectionSettings.Data storage store = _getInstanceStore();
        return store.minNominationPeriodDuration;
    }

    function ElectionSettings_set_minVotingPeriodDuration(uint64 val) external {
        ElectionSettings.Data storage store = _getInstanceStore();
        store.minVotingPeriodDuration = val;
    }

    function ElectionSettings_get_minVotingPeriodDuration() external view returns (uint64) {
        ElectionSettings.Data storage store = _getInstanceStore();
        return store.minVotingPeriodDuration;
    }

    function ElectionSettings_set_maxDateAdjustmentTolerance(uint64 val) external {
        ElectionSettings.Data storage store = _getInstanceStore();
        store.maxDateAdjustmentTolerance = val;
    }

    function ElectionSettings_get_maxDateAdjustmentTolerance() external view returns (uint64) {
        ElectionSettings.Data storage store = _getInstanceStore();
        return store.maxDateAdjustmentTolerance;
    }

    function ElectionSettings_set_defaultBallotEvaluationBatchSize(uint val) external {
        ElectionSettings.Data storage store = _getInstanceStore();
        store.defaultBallotEvaluationBatchSize = val;
    }

    function ElectionSettings_get_defaultBallotEvaluationBatchSize() external view returns (uint) {
        ElectionSettings.Data storage store = _getInstanceStore();
        return store.defaultBallotEvaluationBatchSize;
    }

}
