//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/errors/ArgumentError.sol";
import "../interfaces/IElectionModule.sol";
import "../token/MemberToken.sol";
import "../storage/ElectionStorage.sol";

contract CoreElectionModule is IElectionModule, ElectionStorage, OwnableMixin {
    error MemberTokenAlreadyCreated();

    error AlreadyNominated(address addr);
    error NotNominated(address addr);

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

    function setEpochDuration(uint duration) external override onlyOwner {
        _electionStore().epochDuration = duration;
    }

    function setPeriodPercent(uint8 percent) external override onlyOwner {
        if (percent > 100) {
            revert ArgumentError.NumberTooBig("percent", 100);
        }

        _electionStore().nominationPeriodPercent = percent;
    }

    function setNextSeatCount(uint seats) external override onlyOwner {
        _electionStore().nextSeatCount = seats;
    }

    function setNextEpochDuration(uint duration) external override onlyOwner {
        _electionStore().nextEpochDuration = duration;
    }

    function setNextPeriodPercent(uint8 percent) external override onlyOwner {
        if (percent > 100) {
            revert ArgumentError.NumberTooBig("percent", 100);
        }

        _electionStore().nextNominationPeriodPercent = percent;
    }
}
