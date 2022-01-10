//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../storage/ElectionStorage.sol";

contract ElectionModule is ElectionStorage, OwnableMixin {
    error InvalidEpochEndDate();

    uint64 private const _MIN_EPOCH_DURATION = 7 days;

    function initializeElectionModule(uint64 firstEpochEndDate) external onlyOwner {
        ElectionStore storage store = _electionStore();

        if (store.currentEpochIndex != 0) {
            revert InitError.AlreadyInitialized();
        }

        store.currentEpochIndex = 1;
        EpochData storage epoch = store.epochs[1];

        uint64 currentDate = block.timestamp;
        epoch.startDate = currentDate;

        uint64 epochDuration = firstEpochEndDate - currentDate;
        if (epochDuration < _MIN_EPOCH_DURATION) {
            revert InvalidEpochEndDate();
        }
        epoch.endDate = firstEpochEndDate;
    }

    function getCurrentEpochIndex() public view returns (uint) {
        return _electionStore().currentEpochIndex;
    }

    function getStatus() public view returns (EpochStatus) {
        return EpochStatus.Idle;
    }
}
