//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUUPSImplementation {
    function upgradeTo(address newImplementation) external;

    function simulateUpgradeTo(address newImplementation) external;

    function getImplementation() external view returns (address);
}
