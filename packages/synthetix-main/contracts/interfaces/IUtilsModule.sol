//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Module for miscellaneous functions which may be needed for testing or system start
interface IUtilsModule {
    // allows for enabling of CCIP support
    function registerCcip(
        address ccipSend,
        address ccipReceive,
        address ccipTokenPool
    ) external;

    function configureOracleManager(address oracleManagerAddress) external;
}
