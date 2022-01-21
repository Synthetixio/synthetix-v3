//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISNXTokenModule {
    function initializeSNXTokenModule() external;

    function isSNXTokenModuleInitialized() external view returns (bool);

    function upgradeSNXImplementation(address newSNXTokenImplementation) external;

    function getSNXTokenAddress() external view returns (address);
}
