//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for miscellaneous functions which may be needed for testing or system start
interface IUtilsModule {

    // when the system is first initialized, no system token exists and therefore we need a way to mint it in order to get the system started from 0
    // this function is only callable by the owner and the `totalSupply` of the SNX token must be 0
    function mintInitialSystemToken(address to, uint amount) external;
}
