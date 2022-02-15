//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Change validation error library.
 * @dev Usage: `revert ChangeError.<error-type>(<error-parameters>);`
 */
library ChangeError {
    /**
     * @notice No change error.
     */
    error NoChange();
}
