//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IInitializableModule {
    function isInitializableModuleInitialized() external view returns (bool);

    function initializeInitializableModule() external;
}
