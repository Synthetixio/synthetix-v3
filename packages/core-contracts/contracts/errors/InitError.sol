//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Initialization error library.
 * @dev Usage: `revert InitializationError.<error-type>(<error-parameters>);`
 */
library InitError {
    /**
     * @notice Already initialize error.
     */
    error AlreadyInitialized();

    /**
     * @notice Not initialized error.
     */
    error NotInitialized();
}
