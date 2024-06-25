//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

library Election {
    using SetUtil for SetUtil.Bytes32Set;

    struct Data {
        // True if ballots have been counted in this election
        bool evaluated;
        // Number of counted ballots in this election
        uint256 numEvaluatedBallots;
        // List of nominated candidates in this election
        SetUtil.AddressSet nominees;
        // List of winners of this election (requires evaluation)
        SetUtil.AddressSet winners;
        // List of all ballot ids in this election
        SetUtil.Bytes32Set ballotPtrs;
        // Total votes count for a given candidate
        mapping(address => uint256) candidateVoteTotals;
    }

    function load(uint256 epochIndex) internal pure returns (Data storage election) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.Election", epochIndex));
        assembly {
            election.slot := s
        }
    }
}
