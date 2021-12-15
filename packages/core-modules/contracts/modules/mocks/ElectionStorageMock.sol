//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/ElectionStorage.sol";

contract ElectionStorageMock is ElectionStorage {
    function setSeatCountMock(uint seats) external {
        _electionStore().seatCount = seats;
    }

    function setCurrentEpochMock(
        uint seatCount,
        uint duration,
        uint nominationPercent
    ) external {
        ElectionStore storage store = _electionStore();

        store.epochStart = block.timestamp; // solhint-disable-line not-rely-on-time
        store.seatCount = seatCount;
        store.epochDuration = duration;
        store.nominationPeriodPercent = nominationPercent;
    }

    function resetCurrentEpochMock() external {
        ElectionStore storage store = _electionStore();
        store.epochStart = 0;
        store.seatCount = 0;
        store.epochDuration = 0;
        store.nominationPeriodPercent = 0;
    }

    function getNextEpochRepresentatives() external view returns (address[] memory) {
        return _electionData().nextEpochRepresentatives;
    }

    function getNextEpochRepresentativeVotes() external view returns (uint[] memory) {
        return _electionData().nextEpochRepresentativeVotes;
    }

    function initNextEpochMock() external {
        // solhint-disable-next-line not-rely-on-time
        _electionStore().epochStart = block.timestamp;
        _electionStore().seatCount = _electionStore().nextSeatCount;
        _electionStore().epochDuration = _electionStore().nextEpochDuration;
        _electionStore().nominationPeriodPercent = _electionStore().nextNominationPeriodPercent;
        _electionStore().electionDataIndex++;
    }

    function getVoterVoteCandidatesMock(address addr) public view returns (address[] memory) {
        ElectionData storage electionData = _electionData();
        VoteData storage voteData = electionData.votes[electionData.votesIndexes[addr]];
        return voteData.candidates;
    }

    function getVoterVoteVotePowerMock(address addr) public view returns (uint) {
        ElectionData storage electionData = _electionData();
        VoteData storage voteData = electionData.votes[electionData.votesIndexes[addr]];
        return voteData.votePower;
    }

    // function getEpochStart() public view returns (uint) {
    //     return _electionStore().epochStart;
    // }

    function _electionData() private view returns (ElectionData storage) {
        return _electionStore().electionData[_electionStore().electionDataIndex];
    }
}
