//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/utils/ArrayUtil.sol";
import "../interfaces/IElectionModule.sol";
import "../token/MemberToken.sol";
import "../storage/ElectionStorage.sol";

contract CoreElectionModule is IElectionModule, ElectionStorage, OwnableMixin {
    error MemberTokenAlreadyCreated();
    error AlreadyNominated(address addr);
    error NotNominated(address addr);

    error TooManyCandidates();
    error MissingCandidates();
    error DuplicateCandidates();
    error InvalidPeriodPercent();
    error InvalidBatchSize();

    error FirstEpochAlreadySet();

    error EpochNotFinished();
    error ElectionAlreadyEvaluated();
    error ElectionNotEvaluated();
    error BatchSizeNotSet();

    event MemberTokenCreated(address memberTokenAddress);

    function createMemberToken(string memory tokenName, string memory tokenSymbol) external override onlyOwner {
        ElectionStore storage store = _electionStore();

        if (store.memberTokenAddress != address(0)) {
            revert MemberTokenAlreadyCreated();
        }

        MemberToken firstMemberTokenImplementation = new MemberToken();

        UUPSProxy memberTokenProxy = new UUPSProxy(address(firstMemberTokenImplementation));
        address memberTokenProxyAddress = address(memberTokenProxy);
        MemberToken memberToken = MemberToken(memberTokenProxyAddress);

        memberToken.nominateNewOwner(address(this));
        memberToken.acceptOwnership();
        memberToken.initialize(tokenName, tokenSymbol);

        store.memberTokenAddress = memberTokenProxyAddress;

        emit MemberTokenCreated(memberTokenProxyAddress);
    }

    function upgradeMemberTokenImplementation(address newMemberTokenImplementation) external override onlyOwner {
        MemberToken(getMemberTokenAddress()).upgradeTo(newMemberTokenImplementation);
    }

    function getMemberTokenAddress() public view override returns (address) {
        return _electionStore().memberTokenAddress;
    }

    function setElectionTokenAddress(address addr) external override onlyOwner {
        _electionStore().electionTokenAddress = addr;
    }

    function getElectionTokenAddress() external view override returns (address) {
        return _electionStore().electionTokenAddress;
    }

    function getMembers() external view override returns (address[] memory) {
        return _electionStore().members;
    }

    // TODO: add pagination for getting nominees list
    function getCandidates() external view override returns (address[] memory) {
        return _currentElectionData().candidates;
    }

    function nominate() external override {
        ElectionData storage electionData = _currentElectionData();

        if (electionData.candidatePositions[msg.sender] != 0) {
            revert AlreadyNominated(msg.sender);
        }

        electionData.candidates.push(msg.sender);
        electionData.candidatePositions[msg.sender] = electionData.candidates.length;
    }

    function withdrawNomination() external override {
        ElectionData storage electionData = _currentElectionData();
        if (electionData.candidatePositions[msg.sender] == 0) {
            revert NotNominated(msg.sender);
        }

        ArrayUtil.removeValue(msg.sender, electionData.candidates, electionData.candidatePositions);
    }

    function setNextSeatCount(uint seats) external override onlyOwner {
        _electionStore().nextSeatCount = seats;
    }

    function setNextEpochDuration(uint64 duration) external override onlyOwner {
        _electionStore().nextEpochDuration = duration;
    }

    function setNextPeriodPercent(uint8 percent) external override onlyOwner {
        if (percent > 100) {
            revert InvalidPeriodPercent();
        }

        _electionStore().nextNominationPeriodPercent = percent;
    }

    function getSeatCount() external view override returns (uint) {
        return _electionStore().seatCount;
    }

    function getEpochDuration() external view override returns (uint) {
        return _electionStore().epochDuration;
    }

    function getPeriodPercent() external view override returns (uint) {
        return _electionStore().nominationPeriodPercent;
    }

    function getNextSeatCount() external view override returns (uint) {
        return _electionStore().nextSeatCount;
    }

    function getNextEpochDuration() external view override returns (uint) {
        return _electionStore().nextEpochDuration;
    }

    function getNextPeriodPercent() external view override returns (uint) {
        return _electionStore().nextNominationPeriodPercent;
    }

    function elect(address[] memory candidates) external override {
        ElectionStore storage store = _electionStore();
        ElectionData storage electionData = _currentElectionData();

        uint numCandidates = candidates.length;

        if (numCandidates > electionData.candidates.length) {
            revert TooManyCandidates();
        }

        if (numCandidates == 0) {
            revert MissingCandidates();
        }

        if (ArrayUtil.hasDuplicates(candidates)) {
            revert DuplicateCandidates();
        }

        if (electionData.addressVoted[msg.sender]) {
            uint ballotIndex = electionData.ballotsIndex[msg.sender];
            Ballot memory previousBallot = electionData.ballots[ballotIndex];

            for (uint i = 0; i < previousBallot.candidates.length; i++) {
                electionData.candidateVotes[previousBallot.candidates[i]] -= previousBallot.votePower;
            }

            electionData.ballots[ballotIndex] = Ballot({candidates: new address[](0), votePower: 0});
        }

        uint votePower = ERC20(store.electionTokenAddress).balanceOf(msg.sender);

        for (uint i = 0; i < numCandidates; i++) {
            address candidate = candidates[i];

            if (electionData.candidatePositions[candidate] == 0) {
                revert NotNominated(candidate);
            }

            electionData.candidateVotes[candidate] += votePower;
        }

        Ballot memory ballot = Ballot({candidates: candidates, votePower: votePower});

        electionData.ballots.push(ballot);
        electionData.ballotsIndex[msg.sender] = electionData.ballots.length - 1;

        electionData.addressVoted[msg.sender] = true;
    }

    function isElectionEvaluated() public view virtual override returns (bool) {
        return _currentElectionData().isElectionEvaluated;
    }

    function evaluateElectionBatch() external virtual override {
        if (!isEpochFinished()) {
            revert EpochNotFinished();
        }

        if (isElectionEvaluated()) {
            revert ElectionAlreadyEvaluated();
        }

        if (_electionStore().maxProcessingBatchSize == 0) {
            revert BatchSizeNotSet();
        }

        _evaluateElectionBatchBySimpleCounting();
    }

    function _evaluateElectionBatchBySimpleCounting() internal virtual {
        ElectionStore storage store = _electionStore();
        ElectionData storage electionData = _currentElectionData();

        uint maxBatchSize = store.maxProcessingBatchSize;
        uint previousBatchIndex = electionData.processedBatchIndex;
        uint lessVotedCandidateVotes;
        uint lessVotedCandidateIndex;

        // set initial values
        (lessVotedCandidateIndex, lessVotedCandidateVotes) = _findLessVoted(electionData.nextEpochMemberVotes);

        for (uint offset; offset < maxBatchSize; offset++) {
            uint currentIndex = previousBatchIndex + offset;

            if (currentIndex >= electionData.candidates.length) {
                // all nominees reviewed
                electionData.isElectionEvaluated = true;
                break;
            }

            address currentCandidate = electionData.candidates[currentIndex];
            uint currentCandidateVotes = electionData.candidateVotes[currentCandidate];

            if (currentCandidateVotes > 0) {
                if (electionData.nextEpochMembers.length < store.seatCount) {
                    // seats not filled, fill it with whoever received votes
                    electionData.nextEpochMembers.push(currentCandidate);
                    electionData.nextEpochMemberVotes.push(currentCandidateVotes);

                    if (electionData.nextEpochMembers.length == store.seatCount) {
                        (lessVotedCandidateIndex, lessVotedCandidateVotes) = _findLessVoted(
                            electionData.nextEpochMemberVotes
                        );
                    }
                } else if (currentCandidateVotes > lessVotedCandidateVotes) {
                    // replace minimun
                    electionData.nextEpochMembers[lessVotedCandidateIndex] = currentCandidate;
                    electionData.nextEpochMemberVotes[lessVotedCandidateIndex] = currentCandidateVotes;

                    (lessVotedCandidateIndex, lessVotedCandidateVotes) = _findLessVoted(electionData.nextEpochMemberVotes);
                }
            }
        }

        electionData.processedBatchIndex += maxBatchSize;
    }

    function _findLessVoted(uint[] storage votes) private view returns (uint, uint) {
        if (votes.length == 0) {
            return (0, 0);
        }

        uint minVotes = votes[0];
        uint minIndex = 0;

        for (uint i = 1; i < votes.length; i++) {
            if (votes[i] < minVotes) {
                minVotes = votes[i];
                minIndex = i;
            }
        }

        return (minIndex, minVotes);
    }

    function resolveElection() external virtual override {
        if (!isEpochFinished()) {
            revert EpochNotFinished();
        }

        if (!isElectionEvaluated()) {
            revert ElectionNotEvaluated();
        }

        _resolveElection();
    }

    function _resolveElection() internal virtual {
        ElectionStore storage store = _electionStore();
        MemberToken memberToken = MemberToken(store.memberTokenAddress);
        address[] memory nextEpochMembers = _currentElectionData().nextEpochMembers;
        uint currentMembersSize = store.members.length;
        uint nextEpochMembersSize = nextEpochMembers.length;

        for (uint i = 0; i < currentMembersSize; i++) {
            memberToken.burn(i);
        }

        for (uint i = 0; i < nextEpochMembersSize; i++) {
            memberToken.mint(nextEpochMembers[i], i);
        }

        store.members = nextEpochMembers;
        store.seatCount = store.nextSeatCount;
        store.epochDuration = store.nextEpochDuration;
        store.nominationPeriodPercent = store.nextNominationPeriodPercent;

        store.epochStart = block.timestamp; // solhint-disable-line not-rely-on-time

        _electionStore().latestElectionDataIndex++;
    }

    function isEpochFinished() public view override returns (bool) {
        if (_electionStore().epochStart == 0) {
            return false; // epoch didn't even start
        }

        // solhint-disable-next-line not-rely-on-time
        return block.timestamp > _electionStore().epochStart + _electionStore().epochDuration;
    }

    function isNominating() public view override returns (bool) {
        if (_electionStore().epochStart == 0) {
            return false; // epoch didn't even start
        }

        // the time accuracy we need is in the range of hours or even days.
        // Using timestamp with the risk of seconds manipulation is not an issue here
        return
            // solhint-disable-next-line not-rely-on-time
            block.timestamp <
            _electionStore().epochStart + (_electionStore().nominationPeriodPercent * _electionStore().epochDuration) / 100;
    }

    function isVoting() external view override returns (bool) {
        if (_electionStore().epochStart == 0) {
            return false; // epoch didn't even start
        }

        return !isNominating() && !isEpochFinished();
    }

    function setupFirstEpoch() external override onlyOwner {
        ElectionStore storage store = _electionStore();
        MemberToken memberToken = MemberToken(store.memberTokenAddress);

        if (store.epochStart != 0) {
            revert FirstEpochAlreadySet();
        }

        // Initialize latestElectionDataIndex
        store.latestElectionDataIndex = 1;

        store.epochStart = block.timestamp; // solhint-disable-line not-rely-on-time
        store.seatCount = 1;
        store.epochDuration = 2 days;
        store.nominationPeriodPercent = 0;

        // Set current owner as only council member
        memberToken.mint(msg.sender, 0);
        store.members.push(msg.sender);
    }

    function setMaxProcessingBatchSize(uint256 maxBatchSize) external override onlyOwner {
        if (maxBatchSize == 0) {
            revert InvalidBatchSize();
        }

        _electionStore().maxProcessingBatchSize = maxBatchSize;
    }

    function getMaxProcessingBatchSize() external view override returns (uint256) {
        return _electionStore().maxProcessingBatchSize;
    }

    function _currentElectionData() private view returns (ElectionData storage) {
        return _electionStore().electionData[_electionStore().latestElectionDataIndex];
    }
}
