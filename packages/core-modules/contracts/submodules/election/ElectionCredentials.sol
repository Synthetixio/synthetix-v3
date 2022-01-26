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
        SetUtil.AddressSet storage currentMembers = _electionStore().councilMembers;

        uint numNewMembers = newMembers.length();
        for (uint newMemberIndex = 0; newMemberIndex < numNewMembers; newMemberIndex++) {
            uint newMemberPosition = newMemberIndex + 1;

            address newMember = newMembers.valueAt(newMemberPosition);

            _addMember(currentMembers, newMember);
        }
    }

    function _removeAllMembers() internal {
        SetUtil.AddressSet storage members = _electionStore().councilMembers;

        uint numMembers = members.length();
        for (uint memberIndex = 0; memberIndex < numMembers; memberIndex++) {
            uint memberPosition = memberIndex + 1;

            address member = members.valueAt(memberPosition);

            _removeMember(members, member);
        }
    }

    function _addMember(SetUtil.AddressSet storage members, address newMember) internal {
        if (members.contains(newMember)) {
            revert AlreadyACouncilMember();
        }

        members.add(newMember);

        uint tokenId = members.positionOf(newMember) - 1;

        _getCouncilToken().mint(newMember, tokenId);
    }

    function _removeMember(SetUtil.AddressSet storage members, address member) internal {
        if (!members.contains(member)) {
            revert NotACouncilMember();
        }

        uint tokenId = members.positionOf(member) - 1;

        members.remove(member);

        _getCouncilToken().burn(tokenId);
    }

    function _getCouncilToken() internal view returns (CouncilToken) {
        return CouncilToken(_electionStore().councilToken);
    }
}
