//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/ElectionStorage.sol";

contract ElectionStorageMock is ElectionStorage {
    function getVoterVoteCandidates(address addr) public view returns (address[] memory) {
        ElectionData storage electionData = _electionStore().electionData;
        VoteData storage voteData = electionData.votes[electionData.votesIndexes[addr]];
        return voteData.candidates;
    }

    function getVoterVoteVotePower(address addr) public view returns (uint) {
        ElectionData storage electionData = _electionStore().electionData;
        VoteData storage voteData = electionData.votes[electionData.votesIndexes[addr]];
        return voteData.votePower;
    }
}
