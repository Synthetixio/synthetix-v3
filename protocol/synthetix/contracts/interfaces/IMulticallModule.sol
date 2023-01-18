//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module that enables calling multiple methods of the system in a single transaction.
 */
interface IMulticallModule {
    /**
     * @notice Executes multiple transaction payloads in a single transaction.
     * @dev Each transaction is executed using `delegatecall`, and targets the system address.
     * @param data Array of calldata objects, one for each function that is to be called in the system.
     * @return results Array of each `delegatecall`'s response corresponding to the incoming calldata array.
     */
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);
}
