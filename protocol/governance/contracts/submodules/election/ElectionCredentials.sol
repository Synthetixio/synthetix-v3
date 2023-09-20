//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {UUPSProxy} from "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";
import {ArrayError} from "@synthetixio/core-contracts/contracts/errors/ArrayError.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {IERC721} from "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";
import {AssociatedSystem} from "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import {CouncilMembers} from "../../storage/CouncilMembers.sol";

/// @dev Core functionality for keeping track of council members with an NFT token
contract ElectionCredentials {
    using SetUtil for SetUtil.AddressSet;

    using CouncilMembers for CouncilMembers.Data;
    using AssociatedSystem for AssociatedSystem.Data;

    event CouncilMemberAdded(address indexed member, uint indexed epochIndex);
    event CouncilMemberRemoved(address indexed member, uint indexed epochIndex);

    error AlreadyACouncilMember();
    error NotACouncilMember();

    bytes32 internal constant _COUNCIL_NFT_SYSTEM = "councilToken";

    function _removeAllCouncilMembers(uint epochIndex) internal {
        SetUtil.AddressSet storage members = CouncilMembers.load().councilMembers;

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

        CouncilMembers.Data storage store = CouncilMembers.load();

        for (uint memberIndex = 0; memberIndex < numMembers; memberIndex++) {
            _addCouncilMember(store, membersToAdd[memberIndex], epochIndex);
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
        CouncilMembers.Data storage store,
        address newMember,
        uint epochIndex
    ) internal {
        SetUtil.AddressSet storage members = store.councilMembers;

        if (members.contains(newMember)) {
            revert AlreadyACouncilMember();
        }

        members.add(newMember);

        // Note that tokenId = 0 will not be used.
        uint tokenId = members.length();
        AssociatedSystem.load(_COUNCIL_NFT_SYSTEM).asNft().mint(newMember, tokenId);

        store.councilTokenIds[newMember] = tokenId;

        emit CouncilMemberAdded(newMember, epochIndex);
    }

    function _removeCouncilMember(address member, uint epochIndex) internal {
        CouncilMembers.Data storage store = CouncilMembers.load();
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
        uint tokenId = CouncilMembers.load().councilTokenIds[member];

        if (tokenId == 0) revert NotACouncilMember();

        return tokenId;
    }
}
