//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUUPSImplementation {
    error SterileImplementation(address implementation);
    error SimulatedUpgradeFailed();

    event Upgraded(address implementation);

    function upgradeTo(address newImplementation) external;

    function simulateUpgradeTo(address newImplementation) external;

    function getImplementation() external view returns (address);
}
