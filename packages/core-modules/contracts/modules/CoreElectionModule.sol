//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../token/MemberToken.sol";
import "../storage/CoreElectionStorage.sol";

contract CoreElectionModule is CoreElectionStorage, OwnableMixin {
    error MemberTokenAlreadyCreated();

    event MemberTokenCreated(address memberTokenAddress);

    function createMemberToken(string memory tokenName, string memory tokenSymbol) public onlyOwner {
        ElectionStore storage store = _electionStore();

        if (store.memberTokenAddress != address(0)) {
            revert MemberTokenAlreadyCreated();
        }

        MemberToken firstMemberTokenImplementation = new MemberToken();

        UUPSProxy memberTokenProxy = new UUPSProxy(address(firstMemberTokenImplementation));
        address memberTokenProxyAddress = address(memberTokenProxy);

        MemberToken(memberTokenProxyAddress).nominateNewOwner(address(this));
        MemberToken(memberTokenProxyAddress).acceptOwnership();

        MemberToken(memberTokenProxyAddress).initialize(tokenName, tokenSymbol);

        store.memberTokenAddress = memberTokenProxyAddress;

        emit MemberTokenCreated(memberTokenProxyAddress);
    }

    function upgradeMemberTokenImplementation(address newMemberTokenImplementation) public onlyOwner {
        MemberToken(getMemberTokenAddress()).upgradeTo(newMemberTokenImplementation);
        _electionStore().memberTokenAddress = newMemberTokenImplementation;
    }

    function getMemberTokenAddress() public view returns (address) {
        return _electionStore().memberTokenAddress;
    }
}
