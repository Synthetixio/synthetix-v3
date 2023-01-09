//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IReceiveModule.sol";

/**
 * @title Module for giving a system the ability to receive ETH.
 * See IReceiveModule.
 */
contract ReceiveModule is IReceiveModule {
    /**
     * @inheritdoc IReceiveModule
     */
    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    function forcer123456789abcdefghijk() public {}
}
