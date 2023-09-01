//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Module that enables calling multiple methods of the system in a single transaction.
 */
interface IMulticallModule {
    error RecursiveMulticall(address);
    error DeniedMulticallTarget(address);

    /**
     * @notice Executes multiple transaction payloads in a single transaction.
     * @dev Each transaction is executed using `delegatecall`, and targets the system address.
     * @param data Array of calldata objects, one for each function that is to be called in the system.
     * @return results Array of each `delegatecall`'s response corresponding to the incoming calldata array.
     */
    function multicall(bytes[] calldata data) external returns (bytes[] memory results);

    /**
     * @notice Similar to `multicall`, but allows for transactions to be executed
     * @dev If the address specified in `to` iteration is not the core system, it will call the contract with a regular "call". If it is the core system, it will be delegatecall.
     * @dev Target `to` contracts will need to support calling the below `getMessageSender` rather than regular `msg.sender` in order to allow for usage of permissioned calls with this function
     * @dev It is not possible to call this function recursively.
     * @dev Fails immediately on revert of any call.
     * @return results Array of each call's response corresponding
     */
    function multicallThrough(
        address[] calldata to,
        bytes[] calldata data,
        uint256[] calldata values
    ) external payable returns (bytes[] memory results);

    /**
     * @notice Permit the given target to be called through `multicallThrough`.
     * @dev This function can only be called by the system owner.
     * @param target The address of the contract to alter permissions
     * @param allowlisted Whether or not the target is allowlisted
     */
    function setAllowlistedMulticallTarget(address target, bool allowlisted) external;

    /**
     * @notice When receiving a call from this contract through `multicallThrough`, the receiver can use this function to get the original caller.
     */
    function getMessageSender() external view returns (address);
}
