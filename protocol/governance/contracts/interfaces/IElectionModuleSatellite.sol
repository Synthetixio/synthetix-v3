//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Election module council with minimal logic to be deployed on Satellite chains
interface IElectionModuleSatellite {
    event CouncilMembersDismissed(address[] dismissedMembers, uint256 epochId);

    /// @notice Allows anyone with vote power to vote on nominated candidates during the Voting period
    function cast(address[] calldata candidates, uint256[] calldata amounts) external;

    /// @dev Burn the council tokens from the given members; receiving end of CCIP members dismissal
    function _recvDismissMembers(address[] calldata membersToDismiss, uint256 epochIndex) external;

    /// @dev Burn current epoch council tokens, and assign new ones; receiving end of CCIP epoch resolution
    function _recvResolve(
        address[] calldata winners,
        uint256 prevEpochIndex,
        uint256 newEpochIndex
    ) external;
}
