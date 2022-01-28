//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IInitializableModule  {
    function isAnotherNameModuleInitialized() external view returns (bool);

    function initializeAnotherNameModule() external;
}
