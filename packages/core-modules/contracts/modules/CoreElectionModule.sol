//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import "../interfaces/IElectionModule.sol";
import "../token/MemberToken.sol";
import "../storage/ElectionStorage.sol";

contract CoreElectionModule is IElectionModule, ElectionStorage, OwnableMixin {
    error MemberTokenAlreadyCreated();

    error AlreadyNominated(address addr);
    error NotNominated(address addr);

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

    function selfNominate() external override {
        ElectionStore storage store = _electionStore();

        if (msg.sender == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (store.nomineesIndexes[msg.sender] != 0) {
            revert AlreadyNominated(msg.sender);
        }

        store.nominees.push(msg.sender);
        store.nomineesIndexes[msg.sender] = store.nominees.length;
    }

    function selfUnnominate() external override {
        ElectionStore storage store = _electionStore();

        uint256 valueIndex = store.nomineesIndexes[msg.sender];

        if (msg.sender == address(0)) {
            revert AddressError.ZeroAddress();
        }

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
            store.nomineesIndexes[lastvalue] = valueIndex; // Replace lastvalue's index to valueIndex
        }

        // Delete the slot where the moved value was stored
        store.nominees.pop();

        // Delete the index for the deleted slot
        delete store.nomineesIndexes[msg.sender];
    }
}
