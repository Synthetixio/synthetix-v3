//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {Epoch} from "./Epoch.sol";
import {Election} from "./Election.sol";
import {ElectionSettings} from "./ElectionSettings.sol";

library Council {
    using Epoch for Epoch.Data;
    using ElectionSettings for ElectionSettings.Data;

    error NotCallableInCurrentPeriod();
    error InvalidEpochConfiguration(uint256 code, uint64 v1, uint64 v2);
    error ChangesCurrentPeriod();

    bytes32 private constant _SLOT_COUNCIL_STORAGE =
        keccak256(abi.encode("io.synthetix.governance.Council"));

    struct Data {
        // True if initializeElectionModule was called
        bool initialized;
        // id of the current epoch
        uint256 currentElectionId;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_COUNCIL_STORAGE;
        assembly {
            store.slot := s
        }
    }

    function newElection(Data storage self) internal returns (uint256 newElectionId) {
        newElectionId = ++self.currentElectionId;
    }

    function getCurrentEpoch(Data storage self) internal view returns (Epoch.Data storage epoch) {
        return Epoch.load(self.currentElectionId);
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

    /// @dev Used to allow certain functions to only operate within a given period
    function onlyInPeriod(Epoch.ElectionPeriod period) internal view {
        Epoch.ElectionPeriod currentPeriod = getCurrentEpoch(load()).getCurrentPeriod();
        if (currentPeriod != period) {
            revert NotCallableInCurrentPeriod();
        }
    }

    /// @dev Used to allow certain functions to only operate within a given periods
    function onlyInPeriods(
        Epoch.ElectionPeriod period1,
        Epoch.ElectionPeriod period2
    ) internal view {
        Epoch.ElectionPeriod currentPeriod = getCurrentEpoch(load()).getCurrentPeriod();
        if (currentPeriod != period1 && currentPeriod != period2) {
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
    ) internal view {
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

        epoch.setEpochDates(
            epochStartDate,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );
    }

    /// @dev Changes epoch dates, with validations
    function validateEpochScheduleTweak(
        Data storage self,
        Epoch.Data storage currentEpoch,
        Epoch.Data memory newEpoch
    ) internal view {
        ElectionSettings.Data storage settings = getCurrentElectionSettings(self);

        if (
            uint64AbsDifference(newEpoch.endDate, currentEpoch.startDate + settings.epochDuration) >
            settings.maxDateAdjustmentTolerance ||
            uint64AbsDifference(
                newEpoch.nominationPeriodStartDate,
                currentEpoch.nominationPeriodStartDate
            ) >
            settings.maxDateAdjustmentTolerance ||
            uint64AbsDifference(
                newEpoch.votingPeriodStartDate,
                currentEpoch.votingPeriodStartDate
            ) >
            settings.maxDateAdjustmentTolerance
        ) {
            revert InvalidEpochConfiguration(7, 0, 0);
        }

        validateEpochSchedule(
            self,
            currentEpoch.startDate,
            newEpoch.nominationPeriodStartDate,
            newEpoch.votingPeriodStartDate,
            newEpoch.endDate
        );

        if (Epoch.getPeriodFor(newEpoch) != Epoch.ElectionPeriod.Administration) {
            revert ChangesCurrentPeriod();
        }
    }

    /// @dev Moves schedule forward to immediately jump to the nomination period
    function jumpToNominationPeriod(Data storage self) internal {
        Epoch.Data storage currentEpoch = getCurrentEpoch(self);
        ElectionSettings.Data storage settings = getCurrentElectionSettings(self);

        // Keep the previous durations, but shift everything back
        // so that nominations start now
        uint64 newNominationPeriodStartDate = SafeCastU256.to64(block.timestamp);
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

    function uint64AbsDifference(uint64 valueA, uint64 valueB) private pure returns (uint64) {
        return valueA > valueB ? valueA - valueB : valueB - valueA;
    }
}
