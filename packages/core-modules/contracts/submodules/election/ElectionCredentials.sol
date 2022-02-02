//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "../../tokens/CouncilToken.sol";
import "./ElectionBase.sol";

/// @dev Core functionality for keeping track of council members with an NFT token
contract ElectionCredentials is ElectionBase {
    using SetUtil for SetUtil.AddressSet;

    function _createCouncilToken(string memory tokenName, string memory tokenSymbol) internal {
        CouncilToken implementation = new CouncilToken();

        UUPSProxy proxy = new UUPSProxy(address(implementation));

        CouncilToken token = CouncilToken(address(proxy));

        token.nominateNewOwner(address(this));
        token.acceptOwnership();

        token.initialize(tokenName, tokenSymbol);

        _electionStore().councilToken = address(token);

        emit CouncilTokenCreated(address(proxy), address(implementation));
    }

    function _addCouncilMembers(SetUtil.AddressSet storage newMembers) internal {
        uint numNewMembers = newMembers.length();

        for (uint newMemberPosition = 1; newMemberPosition <= numNewMembers; newMemberPosition++) {
            _addCouncilMember(newMembers.valueAt(newMemberPosition));
        }
    }

    function _removeAllCouncilMembers() internal {
        SetUtil.AddressSet storage members = _electionStore().councilMembers;

        uint numMembers = members.length();

        for (uint memberIndex = 0; memberIndex < numMembers; memberIndex++) {
            // Always removes the first element in the array
            // until none are left.
            _removeCouncilMember(members.valueAt(1));
        }
    }

    function _addCouncilMember(address newMember) internal {
        ElectionStore storage store = _electionStore();
        SetUtil.AddressSet storage members = store.councilMembers;

        if (members.contains(newMember)) {
            revert AlreadyACouncilMember();
        }

        members.add(newMember);

        // Note that tokenId = 0 will not be used.
        uint tokenId = members.length();
        _getCouncilToken().mint(newMember, tokenId);

        store.councilTokenIds[newMember] = tokenId;

        emit CouncilMemberAdded(newMember);
    }

    function _removeCouncilMember(address member) internal {
        ElectionStore storage store = _electionStore();
        SetUtil.AddressSet storage members = store.councilMembers;

        if (!members.contains(member)) {
            revert NotACouncilMember();
        }

        members.remove(member);

        uint tokenId = _getCouncilMemberTokenId(member);
        _getCouncilToken().burn(tokenId);

        // tokenId = 0 means no associated token.
        store.councilTokenIds[member] = 0;

        emit CouncilMemberRemoved(member);
    }

    function _getCouncilToken() private view returns (CouncilToken) {
        return CouncilToken(_electionStore().councilToken);
    }

    function _getCouncilMemberTokenId(address member) private view returns (uint) {
        uint tokenId = _electionStore().councilTokenIds[member];

        if (tokenId == 0) revert NotACouncilMember();

        return tokenId;
    }
}
