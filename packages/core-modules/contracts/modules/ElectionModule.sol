//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../storage/ElectionStorage.sol";
import "../submodules/election/ElectionSchedule.sol";

contract ElectionModule is ElectionStorage, ElectionSchedule, OwnableMixin {
    function initializeElectionModule(
        uint64 epochEndDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate
    ) external onlyOwner {
        ElectionStore storage store = _electionStore();

        if (store.currentEpochIndex != 0) {
            revert InitError.AlreadyInitialized();
        }

        store.currentEpochIndex = 1;

        _configureFirstEpoch(epochEndDate, nominationPeriodStartDate, votingPeriodStartDate);
    }

    function getEpochIndex() public view returns (uint) {
        return _electionStore().currentEpochIndex;
    }
}
