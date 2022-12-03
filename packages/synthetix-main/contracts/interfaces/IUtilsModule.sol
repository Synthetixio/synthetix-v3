//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Module with assorted utility functions.
 */
interface IUtilsModule {
    /**
     * @notice Configure CCIP addresses on the stablecoin.
     */
    function registerCcip(
        address ccipSend,
        address ccipReceive,
        address ccipTokenPool
    ) external;

    /**
     * @notice Configure the system's single oracle manager address.
     */
    function configureOracleManager(address oracleManagerAddress) external;
}
