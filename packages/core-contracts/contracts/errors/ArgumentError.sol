//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ArgumentError {
    error NumberTooBig(bytes32 name, uint256 max);
}
