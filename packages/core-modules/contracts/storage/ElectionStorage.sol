//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ElectionStorage {
    struct ElectionData {
        /**
         * @dev List of all ballot hashes (keccak of concatenated address array)
         */
        bytes32[] ballotHashes;
        /**
         * @dev Details of ballots per hash (the address array)
         */
        mapping(bytes32 => address[]) ballotCandidates;
        /**
         * @dev Votes received by the ballot
         */
        mapping(bytes32 => uint256) ballotVotes;
        /**
         * @dev Vote casted by voter (which ballot choose). It can be modified.
         */
        mapping(address => bytes32) addressVotedBallot;
        /**
         * @dev Votes power of the voter
         */
        mapping(address => uint256) addressVotePower;
        /**
         * @dev History of addresses that voted on any of the elections.
         */
        mapping(address => bool) addressVoted;
        /**
         * @dev Used to keep track of the next epoch's nominees.
         */
        address[] candidates;
        /**
         * @dev Position of an address on the candidates Array. Note that position 1 corresponds to index 0.
         */
        mapping(address => uint256) candidatePositions;
        /**
         * @dev Used to keep track of the latest candidate processed in the last batch.
         */
        uint256 processedBatchIndex;
        /**
         * @dev Flag to indicate if the election was evaluated (if batched, latest batch was processed).
         */
        bool isElectionEvaluated;
        /**
         * @dev Used to keep track of the next epoch's nextEpochMembers.
         */
        address[] nextEpochMembers;
        /**
         * @dev Used to keep track of the next epoch's nextEpochMembers votes.
         * @dev Note the interpretation is dependant on the voting strategy
         */
        uint256[] nextEpochMemberVotes;
        /**
         * @dev number of votes a candidate has for being a council member in the next epoch.
         * @dev Note the interpretation is dependant on the voting strategy
         */
        mapping(address => uint256) candidateVotes;
    }

    struct ElectionStore {
        /**
         * @dev NFT token awarded to council members in the current epoch. It can be taken away by demotion at any moment, or by election in the next epoch.
         */
        address memberTokenAddress;
        /**
         * @dev Regular token used for voting. Requires snapshot functionality to avoid sybil attacks.
         */
        address electionTokenAddress;
        /**
         * @dev Voting data for the current and past elections
         */
        mapping(uint => ElectionData) electionData;
        /**
         * @dev Index pointing to the latest electionDta
         */
        uint latestElectionDataIndex;
        /**
         * @dev Member's addresses in the current epoch.
         */
        address[] members;
        /**
         * @dev Number of members in the current epoch.
         */
        uint seatCount;
        /**
         * @dev Number of members in the next epoch.
         */
        uint nextSeatCount;
        /**
         * @dev Start reference of the current epoch.
         */
        uint epochStart;
        /**
         * @dev Duration of the current epoch.
         */
        uint epochDuration;
        /**
         * @dev Duration of the next epoch.
         */
        uint nextEpochDuration;
        /**
         * @dev Percent of the epoch duration in which only nominations can occur, not voting.
         */
        uint nominationPeriodPercent;
        /**
         * @dev Staging duration for the next epoch.
         */
        uint nextNominationPeriodPercent;
        /**
         * @dev Used to limit the batch size. This shouldn't be erased on an epoch change
         */
        uint256 maxProcessingBatchSize;
    }

    function _electionStore() internal pure returns (ElectionStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.election")) - 1)
            store.slot := 0x4a7bae7406c7467d50a80c6842d6ba8287c729469098e48fc594351749ba4b22
        }
    }
}
