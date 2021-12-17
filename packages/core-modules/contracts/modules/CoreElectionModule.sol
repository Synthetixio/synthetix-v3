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

    error CandidateLengthMismatch();
    error TooManyCandidates();
    error MissingCandidates();
    error DuplicateCandidates();
    error InvalidPeriodPercent();
    error InvalidBatchSize();

    error FirstEpochAlreadySet();

    error EpochNotFinished();
    error ElectionAlreadyEvaluated();
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

    // TODO: add pagination for getting nominees list
    function getNominees() external view override returns (address[] memory) {
        return _currentElectionData().nominees;
    }

    function nominate() external override {
        ElectionData storage electionData = _currentElectionData();

        if (electionData.nomineePositions[msg.sender] != 0) {
            revert AlreadyNominated(msg.sender);
        }

        electionData.nominees.push(msg.sender);
        electionData.nomineePositions[msg.sender] = electionData.nominees.length;
        electionData.nomineeVotes[msg.sender] = 0;
    }

    function withdrawNomination() external override {
        ElectionData storage electionData = _currentElectionData();
        if (electionData.nomineePositions[msg.sender] == 0) {
            revert NotNominated(msg.sender);
        }

        ArrayUtil.removeValue(msg.sender, electionData.nominees, electionData.nomineePositions);
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

    function elect(address[] memory candidates) external override {
        ElectionStore storage store = _electionStore();
        ElectionData storage electionData = _currentElectionData();

        uint length = candidates.length;

        if (length > electionData.nominees.length) {
            revert TooManyCandidates();
        }

        if (length == 0) {
            revert MissingCandidates();
        }

        for (uint i = 0; i < length; i++) {
            address candidate = candidates[i];

            if (electionData.nomineePositions[candidate] == 0) {
                revert NotNominated(candidate);
            }
        }

        if (ArrayUtil.hasDuplicates(candidates)) {
            revert DuplicateCandidates();
        }

        // Clear previous votes if user already voted
        if (electionData.addressVoted[msg.sender]) {
            uint voteDataIndex = electionData.votesIndexes[msg.sender];
            VoteData memory previousVoteData = electionData.votes[voteDataIndex];

            for (uint i = 0; i < previousVoteData.candidates.length; i++) {
                electionData.nomineeVotes[previousVoteData.candidates[i]] -= previousVoteData.votePower;
            }

            electionData.votes[voteDataIndex] = VoteData({candidates: new address[](0), votePower: 0});
        }

        uint votePower = ERC20(store.electionTokenAddress).balanceOf(msg.sender);

        VoteData memory voteData = VoteData({candidates: candidates, votePower: votePower});

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

    // solhint-disable-next-line no-empty-blocks
    function resolveElection() external virtual override {
        // TODO Check preconditions
        // TODO Compare lists and -> fill TO_REMOVE, and TO_ADD
        // TODO Move votes from TO_REMOVE to TO_ADD
        // TODO Burn missing TO_REMOVE
        // TODO Mint missing TO_ADD
        // TODO Flip epochs
        // TODO _electionStore().latestElectionDataIndex++;
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

        if (store.epochStart != 0) {
            revert FirstEpochAlreadySet();
        }

        // Initialize latestElectionDataIndex
        store.latestElectionDataIndex = 1;

        store.epochStart = block.timestamp; // solhint-disable-line not-rely-on-time
        store.seatCount = 1;
        store.epochDuration = 2 days;
        store.nominationPeriodPercent = 0;
        // TODO: Assign current owner as only council member
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
