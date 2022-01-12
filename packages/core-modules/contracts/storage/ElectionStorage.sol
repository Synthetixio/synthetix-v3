//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ElectionStorage {
    enum EpochStatus {
        Idle,
        Nominating,
        Voting,
        Evaluating
    }

    struct EpochData {
        bool evaluated;
        bool resolved;
        uint64 startDate;
        uint64 endDate;
        uint64 nominationPeriodStartDate;
        uint64 votingPeriodStartDate;
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
