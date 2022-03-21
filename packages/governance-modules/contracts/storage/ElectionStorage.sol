//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IDebtShare.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract ElectionStorage {
    struct ElectionStore {
        // True if initializeElectionModule was called
        bool initialized;
        // Current epoch index
        // First epoch is 1
        uint currentEpochIndex;
        // The address of the council NFT
        address councilToken;
        // Council member addresses
        SetUtil.AddressSet councilMembers;
        // Council token id's by council member address
        mapping(address => uint) councilTokenIds;
        // EpochData's by epoch index
        mapping(uint => EpochData) epochs;
        // ElectionData's by epoch index
        mapping(uint => ElectionData) elections;
        // Pointer to ElectionSettings
        // To be always used via store.settings[0]
        mapping(uint => ElectionSettings) settings;
        // Debt share contract used to determine vote power
        IDebtShare debtShareContract;
        // Debt share snapshot id by epoch index
        mapping(uint => uint128) debtShareIds;
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
        uint defaultBallotEvaluationBatchSize;
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
        uint numEvaluatedBallots;
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
        mapping(address => uint) candidateVotes;
        // MerkleRoot
        bytes32 merkleroot;
        // L1 Debt Shares declared for addresses
        mapping(address => uint) l1debtshares;
    }

    struct BallotData {
        // Total accumulated votes in this ballot (needs evaluation)
        uint votes;
        // List of candidates in this ballot
        address[] candidates;
    }

    function _electionSettings() internal view returns (ElectionSettings storage) {
        return _electionStore().settings[0];
    }

    function _electionStore() internal pure returns (ElectionStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.election")) - 1)
            store.slot := 0x4a7bae7406c7467d50a80c6842d6ba8287c729469098e48fc594351749ba4b22
        }
    }
}
