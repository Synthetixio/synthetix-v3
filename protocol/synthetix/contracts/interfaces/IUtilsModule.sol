//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Module with assorted utility functions.
 */
interface IUtilsModule {
    /**
     * @notice Configure CCIP addresses on the stablecoin.
     * @param ccipSend The address on this chain to which CCIP messages will be sent.
     * @param ccipReceive The address on this chain from which CCIP messages will be received.
     * @param ccipTokenPool The address where CCIP fees will be sent to when sending and receiving cross chain messages.
     */
    function registerCcip(address ccipSend, address ccipReceive, address ccipTokenPool) external;

    /**
     * @notice Configure the system's single oracle manager address.
     * @param oracleManagerAddress The address of the oracle manager.
     */
    function configureOracleManager(address oracleManagerAddress) external;
}
