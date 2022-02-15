//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Address validation error library.
 * @dev Usage: `revert AddressError.<error-type>(<error-parameters>);`
 */
library AddressError {
    /**
     * @notice Zero address error.
     */
    error ZeroAddress();

    /**
     * @notice Address is not a contract error.
     */
    error NotAContract(address addr);
}
