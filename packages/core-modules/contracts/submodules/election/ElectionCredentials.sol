//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../../tokens/CouncilToken.sol";
import "./ElectionBase.sol";

contract ElectionCredentials is ElectionBase {
    using SetUtil for SetUtil.AddressSet;

    function _createCouncilToken(string memory tokenName, string memory tokenSymbol) internal {
        ElectionStore storage store = _electionStore();

        CouncilToken firstImplementation = new CouncilToken();

        UUPSProxy proxy = new UUPSProxy(address(firstImplementation));
        address proxyAddress = address(proxy);

        CouncilToken token = CouncilToken(proxyAddress);

        token.nominateNewOwner(address(this));
        token.acceptOwnership();

        token.initialize(tokenName, tokenSymbol);

        store.councilToken = proxyAddress;
    }

    function _addMembers(SetUtil.AddressSet storage newMembers) internal {
        uint numNewMembers = newMembers.length();
        for (uint newMemberIndex = 0; newMemberIndex < numNewMembers; newMemberIndex++) {
            uint newMemberPosition = newMemberIndex + 1;

            address newMember = newMembers.valueAt(newMemberPosition);

            _addMember(_electionStore(), newMember);
        }
    }

    function _removeAllMembers() internal {
        ElectionStore storage store = _electionStore();
        SetUtil.AddressSet storage members = store.councilMembers;

        uint numMembers = members.length();
        for (uint memberIndex = 0; memberIndex < numMembers; memberIndex++) {
            address member = members.valueAt(1);

            _removeMember(store, member);
        }
    }

    function _addMember(ElectionStore storage store, address newMember) internal {
        SetUtil.AddressSet storage members = store.councilMembers;

        if (members.contains(newMember)) {
            revert AlreadyACouncilMember();
        }

        members.add(newMember);

        uint tokenId = members.length();
        _getCouncilToken().mint(newMember, tokenId);

        store.councilTokenIds[newMember] = tokenId;
    }

    function _removeMember(ElectionStore storage store, address member) internal {
        SetUtil.AddressSet storage members = store.councilMembers;

        if (!members.contains(member)) {
            revert NotACouncilMember();
        }

        members.remove(member);

        uint tokenId = _getCouncilMemberTokenId(store, member);
        _getCouncilToken().burn(tokenId);

        store.councilTokenIds[member] = 0;
    }

    function _getCouncilToken() internal view returns (CouncilToken) {
        return CouncilToken(_electionStore().councilToken);
    }

    function _getCouncilMemberTokenId(ElectionStore storage store, address member) internal view returns (uint) {
        uint tokenId = store.councilTokenIds[member];

        // Note that tokenId = 0 will never be used.
        if (tokenId == 0) revert NotACouncilMember();

        return tokenId;
    }
}
