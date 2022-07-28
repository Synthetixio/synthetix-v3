//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for managing snxUSD token as a Satellite
interface IAssociatedSystemsConsumerModule {
    function getToken(bytes32 id) external view returns (address);

    function getNft(bytes32 id) external view returns (address);
}
