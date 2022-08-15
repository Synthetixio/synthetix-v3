//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing preferred and approved funds via SCCPs
interface IFundConfigurationModule {
    /// @notice SCCP sets the preferred fund
    function setPreferredFund(uint fundId) external;

    /// @notice SCCP adds a fundId to the approved list
    function addApprovedFund(uint fundId) external;

    /// @notice SCCP removes a fundId to the approved list
    function removeApprovedFund(uint fundId) external;

    /// @notice gets the preferred fund
    function getPreferredFund() external view returns (uint);

    /// @notice gets the approved funds (list of fundIds)
    function getApprovedFunds() external view returns (uint[] calldata);
}
