// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/// @dev See DapiProxy.sol for comments about usage
interface IApi3Proxy {
    function read() external view returns (int224 value, uint32 timestamp);

    function api3ServerV1() external view returns (address);
}
