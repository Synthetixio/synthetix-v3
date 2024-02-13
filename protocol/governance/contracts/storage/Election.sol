//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "./Ballot.sol";
import "./Epoch.sol";

import "./ElectionSettings.sol";

library Election {
    struct Data {
        Epoch.Data epoch;
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
        mapping(bytes32 => Ballot.Data) ballotsById;
        // Ballot id that each user voted on
        mapping(address => bytes32) ballotIdsByAddress;
        // Number of votes for each candidate
        mapping(address => uint256) candidateVotes;
        ElectionSettings.Data settings;
    }

    function load(uint256 id) internal pure returns (Data storage election) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.Election", id));
        assembly {
            election.slot := s
        }
    }
}
