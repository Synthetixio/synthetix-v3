//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOwnerModule {
    function initializeOwnerModule(address initialOwner) external;

    function isOwnerModuleInitialized() external view returns (bool);
}
