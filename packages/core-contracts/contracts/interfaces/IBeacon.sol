//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBeacon {
    function getImplementation() external view returns (address);

    function upgradeTo(address newImplementation) external;
}
