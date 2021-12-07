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
    error InvalidCandidatesCount();
    error InvalidCandidateRepeat(address addr);
    error InvalidPeriodPercent();
    error FirstEpochAlreadySetUp();

    error AlreadyVoted();

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

    function getNominees() external view override returns (address[] memory) {
        return _electionStore().electionData.nominees;
    }

    function nominate() external override {
        ElectionData storage electionData = _electionStore().electionData;

        if (electionData.nomineeIndexes[msg.sender] != 0) {
            revert AlreadyNominated(msg.sender);
        }

        electionData.nominees.push(msg.sender);
        electionData.nomineeIndexes[msg.sender] = electionData.nominees.length;
        electionData.nomineeVotes[msg.sender] = 0;
    }

    function withdrawNomination() external override {
        ElectionData storage electionData = _electionStore().electionData;

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

    function setSeatCount(uint seats) external override onlyOwner {
        _electionStore().seatCount = seats;
    }

    function setPeriodPercent(uint8 percent) external override onlyOwner {
        if (percent > 100) {
            revert InvalidPeriodPercent();
        }

        _electionStore().nominationPeriodPercent = percent;
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

    function elect(address[] memory candidates) external override {
        ElectionStore storage store = _electionStore();
        ElectionData storage electionData = store.electionData;

        if (candidates.length == 0) {
            revert InvalidCandidatesCount();
        }

        if (electionData.addressVoted[msg.sender]) {
            // TODO: if msg.sender already voted, rollback previous votes and allow to re-vote
            revert AlreadyVoted();
        }

        // The voting power is the amount of votes we are going to assign to the given candidates
        uint votePower = ERC20(store.electionTokenAddress).balanceOf(msg.sender);

        for (uint i = 0; i < candidates.length; i++) {
            address candidate = candidates[i];

            // Check that the candidate is a nominee
            if (electionData.nomineeIndexes[candidate] == 0) {
                revert InvalidCandidate(candidate);
            }

            // Check that all the values on the candidates Array are unique
            if (i < candidates.length - 1) {
                for (uint256 j = i + 1; j < candidates.length; j++) {
                    address nextCandidate = candidates[j];
                    if (candidate == nextCandidate) {
                        revert InvalidCandidateRepeat(candidate);
                    }
                }
            }

            // Assign votes to the given candidate
            electionData.nomineeVotes[candidate] += votePower;
        }

        // Mark the user as already voted
        electionData.addressVoted[msg.sender] = true;
    }

    function getNomineeVotes(address candidate) external view override returns (uint) {
        return _electionStore().electionData.nomineeVotes[candidate];
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

    function setupFirstEpoch() external virtual override {
        ElectionStore storage store = _electionStore();

        if (store.epochStart != 0) {
            revert FirstEpochAlreadySetUp();
        }

        // TODO set epoch 0 seat to 1
        // TODO set epoch 0 period
        // TODO set token for owner

        // Flip epochs
        // solhint-disable-next-line not-rely-on-time
        store.epochStart = block.timestamp;
        store.seatCount = store.nextSeatCount;
        store.epochDuration = store.nextEpochDuration;
        store.nominationPeriodPercent = store.nextNominationPeriodPercent;
    }
}
