//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Module for giving a system owner based access control.
 */
interface IOwnerModule {
    /**
     * @notice Initializes the owner of the module and whatever system that uses the module.
     * @param initialOwner The address that will own the system.
     */
    function initializeOwnerModule(address initialOwner) external;

    /**
     * @notice Determines if the owner is set in the system.
     * @return A boolean with the result of the query.
     */
    function isOwnerModuleInitialized() external view returns (bool);
}
