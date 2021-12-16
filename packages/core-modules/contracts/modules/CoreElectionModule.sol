//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../interfaces/IElectionModule.sol";
import "../token/MemberToken.sol";
import "../storage/ElectionStorage.sol";

contract CoreElectionModule is IElectionModule, ElectionStorage, OwnableMixin {
    error MemberTokenAlreadyCreated();
    error AlreadyNominated(address addr);
    error NotNominated(address addr);

    error InvalidCandidate(address addr);
    error CandidateLengthMismatch();
    error TooManyCandidates();
    error MissingCandidates();
    error DuplicateCandidatePriority();
    error InvalidCandidatePriority(uint priority);
    error DuplicateCandidate(address addr);
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
    function getNominees() external view override returns (address[] memory) {
        return _currentElectionData().nominees;
    }

    function nominate() external override {
        ElectionData storage electionData = _currentElectionData();

        if (electionData.nomineeIndexes[msg.sender] != 0) {
            revert AlreadyNominated(msg.sender);
        }

        electionData.nominees.push(msg.sender);
        electionData.nomineeIndexes[msg.sender] = electionData.nominees.length;
        electionData.nomineeVotes[msg.sender] = 0;
    }

    function withdrawNomination() external override {
        ElectionData storage electionData = _currentElectionData();

        uint256 valueIndex = electionData.nomineeIndexes[msg.sender];

        if (valueIndex == 0) {
            revert NotNominated(msg.sender);
        }

        uint256 toDeleteIndex = valueIndex - 1;
        uint256 lastIndex = electionData.nominees.length - 1;

        // If the address is not the last one on the Array, we have to move it to
        // swap it with the last element, and then pop it, so we don't leave any
        // empty spaces.
        if (lastIndex != toDeleteIndex) {
            address lastvalue = electionData.nominees[lastIndex];

            // Move the last value to the index where the value to delete is
            electionData.nominees[toDeleteIndex] = lastvalue;
            // Update the index for the moved value
            electionData.nomineeIndexes[lastvalue] = valueIndex; // Replace lastvalue's index to valueIndex
        }

        // Delete the slot where the moved value was stored
        electionData.nominees.pop();

        // Delete the index for the deleted slot
        delete electionData.nomineeIndexes[msg.sender];
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

    /// @notice Elect nominees for the next election.
    /// @dev The interface requests the info in two arrays in order to guarantee no duplicates with lower computational cost.
    /// @param numericallySortedCandidates array of nominees addresses sorted numerically starting from lower values
    /// @param priorities array of priorities order for the selected candidates, 0 indexed e.g.: [2, 0, 1]
    function elect(address[] memory numericallySortedCandidates, uint[] memory priorities) external override {
        ElectionStore storage store = _electionStore();
        ElectionData storage electionData = _currentElectionData();

        if (numericallySortedCandidates.length > electionData.nominees.length) {
            revert TooManyCandidates();
        }

        if (numericallySortedCandidates.length == 0) {
            revert MissingCandidates();
        }

        if (numericallySortedCandidates.length != priorities.length) {
            revert CandidateLengthMismatch();
        }

        if (electionData.addressVoted[msg.sender]) {
            uint voteDataIndex = electionData.votesIndexes[msg.sender];
            VoteData memory previousVoteData = electionData.votes[voteDataIndex];

            for (uint i = 0; i < previousVoteData.candidates.length; i++) {
                electionData.nomineeVotes[previousVoteData.candidates[i]] -= previousVoteData.votePower;
            }

            // Cleanup previous vote in store
            electionData.votes[voteDataIndex] = VoteData({candidates: new address[](0), votePower: 0});
        }

        uint votePower = ERC20(store.electionTokenAddress).balanceOf(msg.sender);

        // The goal is to merge the two arrays from the interface, resulting in a single array
        // with the candidates in priority order.
        address[] memory prioritizedCandidates = new address[](numericallySortedCandidates.length);

        for (uint i = 0; i < numericallySortedCandidates.length; i++) {
            address candidate = numericallySortedCandidates[i];
            uint priority = priorities[i];

            if (priority > numericallySortedCandidates.length - 1) {
                revert InvalidCandidatePriority(priority);
            }

            // Validate that the candidate is a nominee
            if (electionData.nomineeIndexes[candidate] == 0) {
                revert InvalidCandidate(candidate);
            }

            // Validate priorities repetition
            if (prioritizedCandidates[priority] != address(0)) {
                revert DuplicateCandidatePriority();
            }

            // Validate candidates repetition
            if (i > 0) {
                address prev = numericallySortedCandidates[i - 1];
                if (candidate <= prev) {
                    revert DuplicateCandidate(candidate);
                }
            }

            prioritizedCandidates[priority] = candidate;
            electionData.nomineeVotes[candidate] += votePower;
        }

        VoteData memory voteData = VoteData({candidates: prioritizedCandidates, votePower: votePower});

        electionData.votes.push(voteData);
        electionData.votesIndexes[msg.sender] = electionData.votes.length - 1;

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
        uint previousBatchIdx = electionData.processedBatchIdx;
        uint lessVotedCandidateVotes;
        uint lessVotedCandidateIdx;

        // set initial values
        (lessVotedCandidateIdx, lessVotedCandidateVotes) = _findLessVoted(electionData.nextEpochMemberVotes);

        for (uint offset; offset < maxBatchSize; offset++) {
            uint currentIdx = previousBatchIdx + offset;

            if (currentIdx >= electionData.nominees.length) {
                // all nominees reviewed
                electionData.isElectionEvaluated = true;
                break;
            }

            address currentNominee = electionData.nominees[currentIdx];
            uint currentNomineeVotes = electionData.nomineeVotes[currentNominee];

            if (currentNomineeVotes > 0) {
                if (electionData.nextEpochMembers.length < store.seatCount) {
                    // seats not filled, fill it with whoever received votes
                    electionData.nextEpochMembers.push(currentNominee);
                    electionData.nextEpochMemberVotes.push(currentNomineeVotes);

                    if (electionData.nextEpochMembers.length == store.seatCount) {
                        (lessVotedCandidateIdx, lessVotedCandidateVotes) = _findLessVoted(electionData.nextEpochMemberVotes);
                    }
                } else if (currentNomineeVotes > lessVotedCandidateVotes) {
                    // replace minimun
                    electionData.nextEpochMembers[lessVotedCandidateIdx] = currentNominee;
                    electionData.nextEpochMemberVotes[lessVotedCandidateIdx] = currentNomineeVotes;

                    (lessVotedCandidateIdx, lessVotedCandidateVotes) = _findLessVoted(electionData.nextEpochMemberVotes);
                }
            }
        }

        electionData.processedBatchIdx += maxBatchSize;
    }

    function _findLessVoted(uint[] storage votes) private view returns (uint, uint) {
        if (votes.length == 0) {
            return (0, 0);
        }

        uint minVotes = votes[0];
        uint minIdx = 0;

        for (uint idx = 1; idx < votes.length; idx++) {
            if (votes[idx] < minVotes) {
                minVotes = votes[idx];
                minIdx = idx;
            }
        }

        return (minIdx, minVotes);
    }

    function resolveElection() external virtual override {
        ElectionStore storage store = _electionStore();
        MemberToken memberToken = MemberToken(store.memberTokenAddress);
        address[] memory nextEpochMembers = _currentElectionData().nextEpochMembers;

        if (!isEpochFinished()) {
            revert EpochNotFinished();
        }

        if (!isElectionEvaluated()) {
            revert ElectionNotEvaluated();
        }

        for (uint i = 0; i < store.members.length; i++) {
            memberToken.burn(i);
        }

        for (uint i = 0; i < nextEpochMembers.length; i++) {
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
        store.members.push(msg.sender);
        memberToken.mint(msg.sender, 0);
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
