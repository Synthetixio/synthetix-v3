//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";

/**
 * @title Module with assorted utility functions.
 */
interface IUtilsModule is IERC165 {
    /**
     * @notice Emitted when a new cross chain network becomes supported by the protocol
     */
    event NewSupportedCrossChainNetwork(uint64 newChainId);

    /**
     * @notice Configure CCIP addresses on the stablecoin.
     * @param ccipRouter The address on this chain to which CCIP messages will be sent or received.
     * @param ccipTokenPool The address where CCIP fees will be sent to when sending and receiving cross chain messages.
     */
    function configureChainlinkCrossChain(address ccipRouter, address ccipTokenPool) external;

    /**
     * @notice Used to add new cross chain networks to the protocol
     * Ignores a network if it matches the current chain id
     * Ignores a network if it has already been added
     * @param supportedNetworks array of all networks that are supported by the protocol
     * @param ccipSelectors the ccip "selector" which maps to the chain id on the same index. must be same length as `supportedNetworks`
     * @return numRegistered the number of networks that were actually registered
     */
    function setSupportedCrossChainNetworks(
        uint64[] memory supportedNetworks,
        uint64[] memory ccipSelectors
    ) external returns (uint256 numRegistered);

    /**
     * @notice Configure the system's single oracle manager address.
     * @param oracleManagerAddress The address of the oracle manager.
     */
    function configureOracleManager(address oracleManagerAddress) external;

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

    /**
     * @notice Read a UINT value from the KV system
     * @param k the key to read
     * @return v the value set on the specified k
     */
    function getConfigUint(bytes32 k) external view returns (uint256 v);

    /**
     * @notice Read a Address value from the KV system
     * @param k the key to read
     * @return v the value set on the specified k
     */
    function getConfigAddress(bytes32 k) external view returns (address v);

    /**
     * @notice Checks if the address is the trusted forwarder
     * @param forwarder The address to check
     * @return Whether the address is the trusted forwarder
     */
    function isTrustedForwarder(address forwarder) external pure returns (bool);

    /**
     * @notice Provides the address of the trusted forwarder
     * @return Address of the trusted forwarder
     */
    function getTrustedForwarder() external pure returns (address);
}
