//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Module for giving a system the ability to receive ETH.
 */
interface IReceiveModule {
    /**
     * @notice Allows the contract to receive ETH.
     */
    receive() external payable;
}
