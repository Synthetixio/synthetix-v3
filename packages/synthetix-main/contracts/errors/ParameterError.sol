//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ParameterError {
    /**
     * @notice Thrown when an invalid parameter is used in a function.
     */
    error InvalidParameter(string incorrectParameter, string help);
}
