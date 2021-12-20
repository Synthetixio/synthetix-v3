//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ElectionStorage {
    struct VoteData {
        /**
         * @dev the ordered list of candidates the user voted
         */
        address[] candidates;
        /**
         * @dev the votig power that the user gave to the candidates list
         */
        uint votePower;
    }

    struct ElectionData {
        /**
         * @dev History of all the votes casted by voter addrees
         */
        VoteData[] votes;
        /**
         * @dev Position of an address on the votes Array.
         */
        mapping(address => uint256) votesIndexes;
        /**
         * @dev number of votes a nominee has for being a council member in the next epoch.
         */
        mapping(address => uint256) nomineeVotes;
        /**
         * @dev History of addresses that voted on any of the elections.
         */
        mapping(address => bool) addressVoted;
        /**
         * @dev Used to keep track of the next epoch's nominees. Gets erased when an epoch starts and a new council takes effect.
         */
        address[] nominees;
        /**
         * @dev Position of an address on the nominees Array. Note that position 1 corresponds to index 0.
         */
        mapping(address => uint256) nomineePositions;
        /**
         * @dev Flag to indicate if the election was evaluated (if batched, latest batch was processed).
         */
        bool isElectionEvaluated;
        /**
         * @dev Used to keep track of the next epoch's nextEpochMembers. Gets erased when an epoch starts and a new council takes effect.
         */
        address[] nextEpochMembers;
        /**
         * @dev Used to keep track of the next epoch's nextEpochMembers votes. Gets erased when an epoch starts and a new council takes effect.
         */
        uint256[] nextEpochMemberVotes;
        /**
         * @dev Used to keep track of the latest nominee processed in the last batch.
         */
        uint256 processedBatchIdx;
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
