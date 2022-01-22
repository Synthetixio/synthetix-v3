//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract ElectionStorage {
    enum ElectionPeriod {
        Null,
        Idle,
        Nomination,
        Vote,
        Evaluation
    }

    struct BallotData {
        uint votes;
        address[] candidates;
    }

    struct ElectionSettings {
        uint64 minEpochDuration;
        uint64 minNominationPeriodDuration;
        uint64 minVotingPeriodDuration;
        uint64 maxDateAdjustmentTolerance;
    }

    struct EpochData {
        bool evaluated;
        bool resolved;
        uint seatCount;
        uint64 startDate;
        uint64 endDate;
        uint64 nominationPeriodStartDate;
        uint64 votingPeriodStartDate;
        SetUtil.AddressSet nominees;
        bytes32[] ballotIds;
        mapping(bytes32 => BallotData) ballotsById;
        mapping(address => bytes32) ballotIdsByAddress;
        address[] members;
        mapping(address => uint) candidateVotes;
    }

    struct ElectionStore {
        bool initialized;
        uint currentEpochIndex;
        ElectionSettings settings;
        mapping(uint => EpochData) epochs;
    }

    function _electionStore() internal pure returns (ElectionStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.election")) - 1)
            store.slot := 0x4a7bae7406c7467d50a80c6842d6ba8287c729469098e48fc594351749ba4b22
        }
    }
}
