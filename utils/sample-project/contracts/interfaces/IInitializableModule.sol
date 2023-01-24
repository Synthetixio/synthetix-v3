//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IInitializableModule {
    function isInitializableModuleInitialized() external view returns (bool);

    function initializeInitializableModule() external;
}
