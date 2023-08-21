//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {Epoch} from "./Epoch.sol";

library Election {
    struct Data {
        Epoch.Data epoch;
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
        bytes32[] ballotPtrs;
        mapping(address => uint256) candidateVoteTotals;
    }

    function load(uint epochIndex) internal pure returns (Data storage election) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.Election", epochIndex));
        assembly {
            election.slot := s
        }
    }
}
