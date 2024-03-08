//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract ElectionStorage {
    bytes32 private constant _SLOT_ELECTION_STORAGE =
        keccak256(abi.encode("io.synthetix.core-utils.Election"));

    struct ElectionStore {
        // True if initializeElectionModule was called
        bool initialized;
        // The address of the council NFT
        address councilToken;
        // Council member addresses
        SetUtil.AddressSet councilMembers;
        // Council token id's by council member address
        mapping(address => uint256) councilTokenIds;
        // Array of EpochData's for each epoch
        EpochData[] epochs;
        // Array of ElectionData's for each election
        ElectionData[] elections;
        // Pointer to ElectionSettings
        // To be always used via store.settings[0] to avoid storage collisions
        mapping(uint256 => ElectionSettings) settings;
    }

    struct ElectionSettings {
        // Number of council members in the next epoch
        uint8 nextEpochSeatCount;
        // Minimum active council members. If too many are dismissed an emergency election is triggered
        uint8 minimumActiveMembers;
        // Minimum epoch duration when adjusting schedules
        uint64 minEpochDuration;
        // Minimum nomination period duration when adjusting schedules
        uint64 minNominationPeriodDuration;
        // Minimum voting period duration when adjusting schedules
        uint64 minVotingPeriodDuration;
        // Maximum size for tweaking epoch schedules (see tweakEpochSchedule)
        uint64 maxDateAdjustmentTolerance;
        // Default batch size when calling evaluate() with numBallots = 0
        uint256 defaultBallotEvaluationBatchSize;
    }

    struct EpochData {
        // Date at which the epoch started
        uint64 startDate;
        // Date at which the epoch's voting period will end
        uint64 endDate;
        // Date at which the epoch's nomination period will start
        uint64 nominationPeriodStartDate;
        // Date at which the epoch's voting period will start
        uint64 votingPeriodStartDate;
    }

    struct ElectionData {
        // True if ballots have been counted in this election
        bool evaluated;
        // True if NFTs have been re-shuffled in this election
        bool resolved;
        // Number of counted ballots in this election
        uint256 numEvaluatedBallots;
        // List of nominated candidates in this election
        SetUtil.AddressSet nominees;
        // List of winners of this election (requires evaluation)
        SetUtil.AddressSet winners;
        // List of all ballot ids in this election
        bytes32[] ballotIds;
        // BallotData by ballot id
        mapping(bytes32 => BallotData) ballotsById;
        // Ballot id that each user voted on
        mapping(address => bytes32) ballotIdsByAddress;
        // Number of votes for each candidate
        mapping(address => uint256) candidateVotes;
    }

    struct BallotData {
        // Total accumulated votes in this ballot (needs evaluation)
        uint256 votes;
        // List of candidates in this ballot
        address[] candidates;
        // Vote power added per voter
        mapping(address => uint256) votesByUser;
    }

    function _electionSettings() internal view returns (ElectionSettings storage) {
        return _electionStore().settings[0];
    }

    function _electionStore() internal pure returns (ElectionStore storage store) {
        bytes32 s = _SLOT_ELECTION_STORAGE;
        assembly {
            store.slot := s
        }
    }
}
