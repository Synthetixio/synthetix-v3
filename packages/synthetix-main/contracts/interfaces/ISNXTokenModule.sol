//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface SNXTokenModule {
    error SNXAlreadyCreated();

    event SNXTokenCreated(address snxAddress);

    function createSNX() external;

    function upgradeSNXImplementation(address newSNXTokenImplementation) external;

    function getSNXTokenAddress() external view returns (address);
}
