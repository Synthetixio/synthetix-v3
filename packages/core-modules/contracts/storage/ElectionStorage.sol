//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract ElectionStorage {
    struct ElectionStore {
        bool initialized;
        uint currentEpochIndex;
        address councilToken;
        SetUtil.AddressSet councilMembers;
        mapping(address => uint) councilTokenIds;
        mapping(uint => EpochData) epochs;
        mapping(uint => ElectionData) elections;
        ElectionSettings settings; // TODO: This kind of nesting could be problematic.
    }

    struct ElectionSettings {
        uint8 nextEpochSeatCount;
        uint64 minEpochDuration;
        uint64 minNominationPeriodDuration;
        uint64 minVotingPeriodDuration;
        uint64 maxDateAdjustmentTolerance;
        uint defaultBallotEvaluationBatchSize;
    }

    struct EpochData {
        uint64 startDate;
        uint64 endDate;
        uint64 nominationPeriodStartDate;
        uint64 votingPeriodStartDate;
    }

    struct ElectionData {
        bool resolved;
        bool evaluated;
        uint numEvaluatedBallots;
        SetUtil.AddressSet nominees;
        SetUtil.AddressSet winners;
        bytes32[] ballotIds;
        mapping(bytes32 => BallotData) ballotsById;
        mapping(address => bytes32) ballotIdsByAddress;
        mapping(address => uint) candidateVotes;
    }

    struct BallotData {
        uint votes;
        address[] candidates;
    }

    enum ElectionPeriod {
        Null,
        Idle,
        Nomination,
        Vote,
        Evaluation
    }

    function _electionStore() internal pure returns (ElectionStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.election")) - 1)
            store.slot := 0x4a7bae7406c7467d50a80c6842d6ba8287c729469098e48fc594351749ba4b22
        }
    }
}
