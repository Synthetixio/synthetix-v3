//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;


interface IRouter {
   function getModule(bytes32 moduleId) external pure returns(address module);
}
