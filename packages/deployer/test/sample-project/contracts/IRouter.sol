//SPDX-License-Identifier: Unlicense
pragma solidity >0.8.0;

interface IRouter {
    function getModuleAddress(bytes32 name) external pure returns (address);
}
