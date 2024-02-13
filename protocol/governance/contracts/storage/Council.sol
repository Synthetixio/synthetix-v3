//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "./Election.sol";

library Council {
    struct Data {
        // True if initializeElectionModule was called
        bool initialized;
        // The address of the council NFT
        address councilToken;
        // Council member addresses
        SetUtil.AddressSet councilMembers;
        // Council token id's by council member address
        mapping(address => uint256) councilTokenIds;
        // id of the last election
        uint256 lastElectionId;
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

    function load() internal pure returns (Data storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.election")) - 1)
            store.slot := 0x4a7bae7406c7467d50a80c6842d6ba8287c729469098e48fc594351749ba4b22
        }
    }

    function newElection(Data storage self) internal returns (uint256) {
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
    function getCurrentPeriod(Data storage self) internal view returns (ElectionPeriod) {
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
