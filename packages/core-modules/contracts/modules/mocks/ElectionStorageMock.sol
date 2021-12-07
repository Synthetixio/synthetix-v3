//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/ElectionStorage.sol";

contract ElectionStorageMock is ElectionStorage {
    function setNextSeatCountMock(uint seats) external {
        _electionStore().seatCount = seats;
    }

    function getVoterVoteCandidatesMock(address addr) public view returns (address[] memory) {
        ElectionData storage electionData = _electionStore().electionData;
        VoteData storage voteData = electionData.votes[electionData.votesIndexes[addr]];
        return voteData.candidates;
    }

    function getVoterVoteVotePowerMock(address addr) public view returns (uint) {
        ElectionData storage electionData = _electionStore().electionData;
        VoteData storage voteData = electionData.votes[electionData.votesIndexes[addr]];
        return voteData.votePower;
    }
}
