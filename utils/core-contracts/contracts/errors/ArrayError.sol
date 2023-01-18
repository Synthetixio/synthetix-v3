//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Library for array related errors.
 */
library ArrayError {
    /**
     * @dev Thrown when an unexpected empty array is detected.
     */
    error EmptyArray();

    /**
     * @dev Thrown when attempting to access an array beyond its current number of items.
     */
    error OutOfBounds();
}
