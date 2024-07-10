//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ElectionCredentials} from "../submodules/election/ElectionCredentials.sol";

/// @dev Helper functions to test council members functionality
contract CouncilMemberMock is ElectionCredentials {
    function addCouncilMembersMock(address[] memory membersToAdd, uint256 epochIndex) external {
        _addCouncilMembers(membersToAdd, epochIndex);
    }

    function removeAllCouncilMembersMock(uint256 epochIndex) external {
        _removeAllCouncilMembers(epochIndex);
    }
}
