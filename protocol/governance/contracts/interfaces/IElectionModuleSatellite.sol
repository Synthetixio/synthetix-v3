//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Election module council with minimal logic to be deployed on Satellite chains
interface IElectionModuleSatellite {
    /// @notice Allows anyone with vote power to vote on nominated candidates during the Voting period
    function cast(address[] calldata candidates, uint256[] calldata amounts) external;
}
