//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUUPSImplementation {
    function nominateNewImplementation(address newImplementation) external;

    function getNominatedImplementation() external view returns (address);

    function acceptUpgradeNomination() external;

    function renounceUpgradeNomination() external;

    function simulateUpgradeTo(address newImplementation) external;

    function getImplementation() external view returns (address);
}
