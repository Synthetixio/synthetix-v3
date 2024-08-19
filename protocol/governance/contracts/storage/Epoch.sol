//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

library Epoch {
    using SafeCastU256 for uint256;

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

    struct Data {
        // Date at which the epoch started
        uint64 startDate;
        // Date at which the epoch's nomination period will start
        uint64 nominationPeriodStartDate;
        // Date at which the epoch's voting period will start
        uint64 votingPeriodStartDate;
        // Date at which the epoch's voting period will end
        uint64 endDate;
    }

    function load(uint256 epochIndex) internal pure returns (Data storage epoch) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.Epoch", epochIndex));
        assembly {
            epoch.slot := s
        }
    }

    function setEpochDates(
        Epoch.Data storage self,
        uint64 startDate,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 endDate
    ) internal {
        self.startDate = startDate;
        self.nominationPeriodStartDate = nominationPeriodStartDate;
        self.votingPeriodStartDate = votingPeriodStartDate;
        self.endDate = endDate;
    }

    /// @dev Determines the current period type according to the current time and the epoch's dates
    function getCurrentPeriod(Data storage epoch) internal view returns (Epoch.ElectionPeriod) {
        uint64 currentTime = block.timestamp.to64();

        if (currentTime >= epoch.endDate) {
            return ElectionPeriod.Evaluation;
        }

        if (currentTime >= epoch.votingPeriodStartDate) {
            return ElectionPeriod.Vote;
        }

        if (currentTime >= epoch.nominationPeriodStartDate) {
            return ElectionPeriod.Nomination;
        }

        return ElectionPeriod.Administration;
    }

    function getPeriodFor(Data memory epoch) internal view returns (Epoch.ElectionPeriod) {
        uint64 currentTime = block.timestamp.to64();

        if (currentTime >= epoch.endDate) {
            return ElectionPeriod.Evaluation;
        }

        if (currentTime >= epoch.votingPeriodStartDate) {
            return ElectionPeriod.Vote;
        }

        if (currentTime >= epoch.nominationPeriodStartDate) {
            return ElectionPeriod.Nomination;
        }

        return ElectionPeriod.Administration;
    }
}
