//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

contract ElectionStorage {
    enum ElectionPeriod {
        Idle,
        Nomination,
        Vote,
        Evaluation
    }

    struct BallotData {
        uint votes;
        address[] candidates;
    }

    struct EpochData {
        bool evaluated;
        bool resolved;
        uint64 startDate;
        uint64 duration;
        uint64 nominationPeriodDuration;
        uint64 votingPeriodDuration;
        SetUtil.AddressSet nominees;
        mapping(bytes32 => BallotData) ballotsById;
        mapping(address => bytes32) ballotsByAddress;
    }

    struct ElectionStore {
        uint currentEpochIndex;
        mapping(uint => EpochData) epochs;
    }

    function _electionStore() internal pure returns (ElectionStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.election")) - 1)
            store.slot := 0x4a7bae7406c7467d50a80c6842d6ba8287c729469098e48fc594351749ba4b22
        }
    }
}
