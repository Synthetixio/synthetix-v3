//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Access control error library.
 * @dev Usage: `revert AccessError.<error-type>(<error-parameters>);`
 */
library AccessError {
    /**
     * @notice Unauthorized error.
     * @param address The address that is not authorized.
     */
    error Unauthorized(address addr);
}
