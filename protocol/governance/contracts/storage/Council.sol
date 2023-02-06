//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "./Election.sol";

library Council {
    bytes32 private constant _SLOT_COUNCIL =
        keccak256(abi.encode("io.synthetix.governance.council"));

    struct Data {
        // True if initializeElectionModule was called
        bool initialized;
        // Council member addresses
        SetUtil.AddressSet councilMembers;
        // Council token id's by council member address
        mapping(address => uint) councilTokenIds;
        // id of the last election
        uint lastElectionId;
        ElectionSettings.Data nextElectionSettings;
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

    function load() internal pure returns (Data storage council) {
        bytes32 s = _SLOT_COUNCIL;
        assembly {
            council.slot := s
        }
    }

    function newElection(Data storage self) internal returns (uint) {
        return ++self.lastElectionId;
    }

    function getCurrentElection(
        Data storage self
    ) internal view returns (Election.Data storage election) {
        return Election.load(self.lastElectionId);
    }

    function getPreviousElection(
        Data storage self
    ) internal view returns (Election.Data storage election) {
        // NOTE: will revert if there was no previous election
        return Election.load(self.lastElectionId - 1);
    }

    /// @dev Determines the current period type according to the current time and the epoch's dates
    function getCurrentPeriod(Data storage self) internal view returns (Council.ElectionPeriod) {
        Epoch.Data storage epoch = getCurrentElection(self).epoch;

        // solhint-disable-next-line numcast/safe-cast
        uint64 currentTime = uint64(block.timestamp);

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
