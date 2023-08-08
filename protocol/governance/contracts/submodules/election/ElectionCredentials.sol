//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import "@synthetixio/core-contracts/contracts/errors/ArrayError.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

import "../../storage/Council.sol";

/// @dev Core functionality for keeping track of council members with an NFT token
contract ElectionCredentials {
    using SetUtil for SetUtil.AddressSet;

    using Council for Council.Data;
    using AssociatedSystem for AssociatedSystem.Data;

    event CouncilMemberAdded(address indexed member, uint indexed epochIndex);
    event CouncilMemberRemoved(address indexed member, uint indexed epochIndex);

    error AlreadyACouncilMember();
    error NotACouncilMember();

    bytes32 internal constant _COUNCIL_NFT_SYSTEM = "councilToken";

    function _removeAllCouncilMembers(uint epochIndex) internal {
        SetUtil.AddressSet storage members = Council.load().councilMembers;

        uint numMembers = members.length();

        for (uint memberIndex = 0; memberIndex < numMembers; memberIndex++) {
            // Always removes the first element in the array
            // until none are left.
            _removeCouncilMember(members.valueAt(1), epochIndex);
        }
    }

    function _addCouncilMembers(address[] memory membersToAdd, uint epochIndex) internal {
        uint numMembers = membersToAdd.length;
        if (numMembers == 0) revert ArrayError.EmptyArray();

        Council.Data storage council = Council.load();

        for (uint memberIndex = 0; memberIndex < numMembers; memberIndex++) {
            _addCouncilMember(council, membersToAdd[memberIndex], epochIndex);
        }
    }

    function _removeCouncilMembers(address[] memory membersToRemove, uint epochIndex) internal {
        uint numMembers = membersToRemove.length;
        if (numMembers == 0) revert ArrayError.EmptyArray();

        for (uint memberIndex = 0; memberIndex < numMembers; memberIndex++) {
            _removeCouncilMember(membersToRemove[memberIndex], epochIndex);
        }
    }

    function _addCouncilMember(
        Council.Data storage council,
        address newMember,
        uint epochIndex
    ) internal {
        SetUtil.AddressSet storage members = council.councilMembers;

        if (members.contains(newMember)) {
            revert AlreadyACouncilMember();
        }

        members.add(newMember);

        // Note that tokenId = 0 will not be used.
        uint tokenId = members.length();
        AssociatedSystem.load(_COUNCIL_NFT_SYSTEM).asNft().mint(newMember, tokenId);

        council.councilTokenIds[newMember] = tokenId;

        emit CouncilMemberAdded(newMember, epochIndex);
    }

    function _removeCouncilMember(address member, uint epochIndex) internal {
        Council.Data storage store = Council.load();
        SetUtil.AddressSet storage members = store.councilMembers;

        if (!members.contains(member)) {
            revert NotACouncilMember();
        }

        members.remove(member);

        uint tokenId = _getCouncilMemberTokenId(member);
        AssociatedSystem.load(_COUNCIL_NFT_SYSTEM).asNft().burn(tokenId);

        // tokenId = 0 means no associated token.
        store.councilTokenIds[member] = 0;

        emit CouncilMemberRemoved(member, epochIndex);
    }

    function _getCouncilToken() private view returns (IERC721) {
        return AssociatedSystem.load(_COUNCIL_NFT_SYSTEM).asNft();
    }

    function _getCouncilMemberTokenId(address member) private view returns (uint) {
        uint tokenId = Council.load().councilTokenIds[member];

        if (tokenId == 0) revert NotACouncilMember();

        return tokenId;
    }
}
