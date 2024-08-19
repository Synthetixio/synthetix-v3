//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ArrayError} from "@synthetixio/core-contracts/contracts/errors/ArrayError.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {AssociatedSystem} from "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import {CouncilMembers} from "../../storage/CouncilMembers.sol";

/// @dev Core functionality for keeping track of council members with an NFT token
contract ElectionCredentials {
    using SetUtil for SetUtil.AddressSet;

    using CouncilMembers for CouncilMembers.Data;
    using AssociatedSystem for AssociatedSystem.Data;

    event CouncilMemberAdded(address indexed member, uint256 indexed epochIndex);
    event CouncilMemberRemoved(address indexed member, uint256 indexed epochIndex);

    error AlreadyACouncilMember();
    error NotACouncilMember();

    bytes32 internal constant _COUNCIL_NFT_SYSTEM = "councilToken";

    function _removeAllCouncilMembers(uint256 epochIndex) internal {
        SetUtil.AddressSet storage members = CouncilMembers.load().councilMembers;

        uint256 numMembers = members.length();

        for (uint256 memberIndex = 0; memberIndex < numMembers; memberIndex++) {
            // Always removes the first element in the array
            // until none are left.
            _removeCouncilMember(members.valueAt(1), epochIndex);
        }
    }

    function _addCouncilMembers(address[] memory membersToAdd, uint256 epochIndex) internal {
        uint256 numMembers = membersToAdd.length;
        if (numMembers == 0) revert ArrayError.EmptyArray();

        CouncilMembers.Data storage store = CouncilMembers.load();

        for (uint256 memberIndex = 0; memberIndex < numMembers; memberIndex++) {
            _addCouncilMember(store, membersToAdd[memberIndex], epochIndex);
        }
    }

    function _removeCouncilMembers(address[] memory membersToRemove, uint256 epochIndex) internal {
        uint256 numMembers = membersToRemove.length;
        if (numMembers == 0) revert ArrayError.EmptyArray();

        for (uint256 memberIndex = 0; memberIndex < numMembers; memberIndex++) {
            _removeCouncilMember(membersToRemove[memberIndex], epochIndex);
        }
    }

    function _addCouncilMember(
        CouncilMembers.Data storage store,
        address newMember,
        uint256 epochIndex
    ) internal {
        SetUtil.AddressSet storage members = store.councilMembers;

        if (members.contains(newMember)) {
            revert AlreadyACouncilMember();
        }

        members.add(newMember);

        uint256 tokenId = _getCouncilMemberTokenId(newMember);
        AssociatedSystem.load(_COUNCIL_NFT_SYSTEM).asNft().mint(newMember, tokenId);

        emit CouncilMemberAdded(newMember, epochIndex);
    }

    function _removeCouncilMember(address member, uint256 epochIndex) internal {
        CouncilMembers.Data storage store = CouncilMembers.load();
        SetUtil.AddressSet storage members = store.councilMembers;

        if (!members.contains(member)) {
            revert NotACouncilMember();
        }

        members.remove(member);

        uint256 tokenId = _getCouncilMemberTokenId(member);
        AssociatedSystem.load(_COUNCIL_NFT_SYSTEM).asNft().burn(tokenId);

        emit CouncilMemberRemoved(member, epochIndex);
    }

    /// @dev cast member address to uint256 to use as tokenId
    function _getCouncilMemberTokenId(address member) private pure returns (uint256) {
        // solhint-disable-next-line numcast/safe-cast
        return uint256(uint160(member));
    }
}
