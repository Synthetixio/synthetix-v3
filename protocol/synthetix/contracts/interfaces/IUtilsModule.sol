//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./external/IOracleManager.sol";

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

    /**
     * @notice Retrieve the systems' configured oracle manager address
     */
    function getOracleManager() external returns (IOracleManager);

    /**
     * @notice Configure a generic value in the KV system
     * @param k the key of the value to set
     * @param v the value that the key should be set to
     */
    function setConfig(bytes32 k, bytes32 v) external;

    /**
     * @notice Read a generic value from the KV system
     * @param k the key to read
     * @return v the value set on the specified k
     */
    function getConfig(bytes32 k) external view returns (bytes32 v);
}
