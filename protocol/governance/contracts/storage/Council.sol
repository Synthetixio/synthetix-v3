//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "./Election.sol";
import "./ElectionSettings.sol";

library Council {
    using ElectionSettings for ElectionSettings.Data;

    error NotCallableInCurrentPeriod();
    error InvalidEpochConfiguration(uint256 code, uint64 v1, uint64 v2);
    error ChangesCurrentPeriod();

    bytes32 private constant _SLOT_COUNCIL_STORAGE =
        keccak256(abi.encode("io.synthetix.governance.Council"));

    struct Data {
        // True if initializeElectionModule was called
        bool initialized;
        // The address of the council NFT
        address councilToken;
        // Council member addresses
        SetUtil.AddressSet councilMembers;
        // Council token id's by council member address
        mapping(address => uint) councilTokenIds;
        // id of the current epoch
        uint currentElectionId;
    }

    enum ElectionPeriod {
        // Council elected and active
        Administration,
        // Accepting nominations for next election
        Nomination,
        // Accepting votes for ongoing election
        Vote,
        // Votes being counted
        Evaluation
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_COUNCIL_STORAGE;
        assembly {
            store.slot := s
        }
    }

    function newElection(Data storage self) internal returns (uint newElectionId) {
        getNextElectionSettings(self).copyMissingFrom(getCurrentElectionSettings(self));
        newElectionId = ++self.currentElectionId;
        initScheduleFromSettings(self);
    }

    function getCurrentElection(
        Data storage self
    ) internal view returns (Election.Data storage election) {
        return Election.load(self.currentElectionId);
    }

    function getPreviousElection(
        Data storage self
    ) internal view returns (Election.Data storage election) {
        // NOTE: will revert if there was no previous election
        return Election.load(self.currentElectionId - 1);
    }

    function getCurrentElectionSettings(
        Data storage self
    ) internal view returns (ElectionSettings.Data storage settings) {
        return ElectionSettings.load(self.currentElectionId);
    }

    function getPreviousElectionSettings(
        Data storage self
    ) internal view returns (ElectionSettings.Data storage settings) {
        // NOTE: will revert if there was no previous settings
        return ElectionSettings.load(self.currentElectionId - 1);
    }

    function getNextElectionSettings(
        Data storage self
    ) internal view returns (ElectionSettings.Data storage settings) {
        return ElectionSettings.load(self.currentElectionId + 1);
    }

    /// @dev Determines the current period type according to the current time and the epoch's dates
    function getCurrentPeriod(Data storage self) internal view returns (Council.ElectionPeriod) {
        Epoch.Data storage epoch = getCurrentElection(self).epoch;

        // solhint-disable-next-line numcast/safe-cast
        uint64 currentTime = uint64(block.timestamp);

        if (currentTime >= epoch.endDate) {
            return Council.ElectionPeriod.Evaluation;
        }

        if (currentTime >= epoch.votingPeriodStartDate) {
            return Council.ElectionPeriod.Vote;
        }

        if (currentTime >= epoch.nominationPeriodStartDate) {
            return Council.ElectionPeriod.Nomination;
        }

        return Council.ElectionPeriod.Administration;
    }

    /// @dev Used to allow certain functions to only operate within a given period
    function onlyInPeriod(Council.ElectionPeriod period) internal view {
        if (getCurrentPeriod(load()) != period) {
            revert NotCallableInCurrentPeriod();
        }
    }

    /// @dev Ensures epoch dates are in the correct order, durations are above minimums, etc
    function validateEpochSchedule(
        Data storage self,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) private view {
        if (epochEndDate <= votingPeriodStartDate) {
            revert InvalidEpochConfiguration(1, epochEndDate, votingPeriodStartDate);
        } else if (votingPeriodStartDate <= nominationPeriodStartDate) {
            revert InvalidEpochConfiguration(2, votingPeriodStartDate, nominationPeriodStartDate);
        } else if (nominationPeriodStartDate <= epochStartDate) {
            revert InvalidEpochConfiguration(3, nominationPeriodStartDate, epochStartDate);
        }

        uint64 epochDuration = epochEndDate - epochStartDate;
        uint64 votingPeriodDuration = epochEndDate - votingPeriodStartDate;
        uint64 nominationPeriodDuration = votingPeriodStartDate - nominationPeriodStartDate;

        ElectionSettings.Data storage settings = getCurrentElectionSettings(self);

        if (epochDuration < settings.nominationPeriodDuration + settings.votingPeriodDuration) {
            revert InvalidEpochConfiguration(
                4,
                epochDuration,
                settings.nominationPeriodDuration + settings.votingPeriodDuration
            );
        } else if (nominationPeriodDuration < settings.nominationPeriodDuration) {
            revert InvalidEpochConfiguration(
                5,
                nominationPeriodDuration,
                settings.nominationPeriodDuration
            );
        } else if (votingPeriodDuration < settings.votingPeriodDuration) {
            revert InvalidEpochConfiguration(
                6,
                votingPeriodDuration,
                settings.votingPeriodDuration
            );
        }
    }

    function configureEpochSchedule(
        Data storage self,
        Epoch.Data storage epoch,
        uint64 epochStartDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate
    ) internal {
        validateEpochSchedule(
            self,
            epochStartDate,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );

        epoch.startDate = epochStartDate;
        epoch.nominationPeriodStartDate = nominationPeriodStartDate;
        epoch.votingPeriodStartDate = votingPeriodStartDate;
        epoch.endDate = epochEndDate;
    }

    /// @dev Changes epoch dates, with validations
    function adjustEpochSchedule(
        Data storage self,
        Epoch.Data storage epoch,
        uint64 newNominationPeriodStartDate,
        uint64 newVotingPeriodStartDate,
        uint64 newEpochEndDate,
        bool ensureChangesAreSmall
    ) internal {
        if (ensureChangesAreSmall) {
            ElectionSettings.Data storage settings = getCurrentElectionSettings(self);

            if (
                uint64AbsDifference(newEpochEndDate, epoch.startDate + settings.epochDuration) >
                settings.maxDateAdjustmentTolerance ||
                uint64AbsDifference(newNominationPeriodStartDate, epoch.nominationPeriodStartDate) >
                settings.maxDateAdjustmentTolerance ||
                uint64AbsDifference(newVotingPeriodStartDate, epoch.votingPeriodStartDate) >
                settings.maxDateAdjustmentTolerance
            ) {
                revert InvalidEpochConfiguration(7, 0, 0);
            }
        }

        configureEpochSchedule(
            self,
            epoch,
            epoch.startDate,
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate
        );

        if (getCurrentPeriod(self) != Council.ElectionPeriod.Administration) {
            revert ChangesCurrentPeriod();
        }
    }

    /// @dev Moves schedule forward to immediately jump to the nomination period
    function jumpToNominationPeriod(Data storage self) internal {
        Epoch.Data storage currentEpoch = getCurrentElection(self).epoch;
        ElectionSettings.Data storage settings = getCurrentElectionSettings(self);

        // Keep the previous durations, but shift everything back
        // so that nominations start now
        uint64 newNominationPeriodStartDate = uint64(block.timestamp);
        uint64 newVotingPeriodStartDate = newNominationPeriodStartDate +
            settings.nominationPeriodDuration;
        uint64 newEpochEndDate = newVotingPeriodStartDate + settings.votingPeriodDuration;

        configureEpochSchedule(
            self,
            currentEpoch,
            currentEpoch.startDate,
            newNominationPeriodStartDate,
            newVotingPeriodStartDate,
            newEpochEndDate
        );
    }

    function initScheduleFromSettings(Data storage self) internal {
        ElectionSettings.Data storage settings = getCurrentElectionSettings(self);

        uint64 currentEpochStartDate = uint64(block.timestamp);
        uint64 currentEpochEndDate = currentEpochStartDate + settings.epochDuration;
        uint64 currentVotingPeriodStartDate = currentEpochEndDate - settings.votingPeriodDuration;
        uint64 currentNominationPeriodStartDate = currentVotingPeriodStartDate -
            settings.nominationPeriodDuration;

        configureEpochSchedule(
            self,
            getCurrentElection(self).epoch,
            currentEpochStartDate,
            currentNominationPeriodStartDate,
            currentVotingPeriodStartDate,
            currentEpochEndDate
        );
    }

    function uint64AbsDifference(uint64 valueA, uint64 valueB) private pure returns (uint64) {
        return valueA > valueB ? valueA - valueB : valueB - valueA;
    }
}
