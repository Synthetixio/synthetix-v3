//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../interfaces/IElectionModule.sol";
import "../token/MemberToken.sol";
import "../storage/ElectionStorage.sol";

contract CoreElectionModule is IElectionModule, ElectionStorage, OwnableMixin {
    event MemberTokenCreated(address memberTokenAddress);

    error MemberTokenAlreadyCreated();
    error AlreadyNominated(address addr);
    error NotNominated(address addr);
    error InvalidPeriodPercent();
    error InvalidCandidatesCount();
    error FirstEpochAlreadySetUp();

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
        return _electionStore().nominees;
    }

    function nominate() external override {
        ElectionStore storage store = _electionStore();

        if (store.nomineeIndexes[msg.sender] != 0) {
            revert AlreadyNominated(msg.sender);
        }

        store.nominees.push(msg.sender);
        store.nomineeIndexes[msg.sender] = store.nominees.length;
        store.nomineeVotes[msg.sender] = 0;
    }

    function withdrawNomination() external override {
        ElectionStore storage store = _electionStore();

        uint256 valueIndex = store.nomineeIndexes[msg.sender];

        if (valueIndex == 0) {
            revert NotNominated(msg.sender);
        }

        uint256 toDeleteIndex = valueIndex - 1;
        uint256 lastIndex = store.nominees.length - 1;

        // If the address is not the last one on the Array, we have to move it to
        // swap it with the last element, and then pop it, so we don't leave any
        // empty spaces.
        if (lastIndex != toDeleteIndex) {
            address lastvalue = store.nominees[lastIndex];

            // Move the last value to the index where the value to delete is
            store.nominees[toDeleteIndex] = lastvalue;
            // Update the index for the moved value
            store.nomineeIndexes[lastvalue] = valueIndex; // Replace lastvalue's index to valueIndex
        }

        // Delete the slot where the moved value was stored
        store.nominees.pop();

        // Delete the index for the deleted slot
        delete store.nomineeIndexes[msg.sender];
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

    function elect(address[] memory candidates) external view override {
        uint seatCount = _electionStore().nextSeatCount;

        if (candidates.length != seatCount) {
            revert InvalidCandidatesCount();
        }

        // TODO: if msg.sender already voted, rollback previous votes.

        // TODO: Assign votes to each address (same to all)
        // uint votePower = ERC20(_electionStore().electionTokenAddress).balanceOf(msg.sender);

        // TODO: Recalculate top [seatsCount] nominees
        //   _minimunIdx;
        //   _minimumValue;
        //   if votes > minimum
        //     electionTopNominees[last][minumunNomineeTop] = msg.sender
        //     for () // get new minimum (idx & value)

        // TODO: Mark msg.sender as already voted on electionVotes
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
        store.nominees = new address[](0);
    }
}
