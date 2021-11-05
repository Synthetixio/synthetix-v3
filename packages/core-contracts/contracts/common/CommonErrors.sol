//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface CommonErrors {
    error InvalidAddress(address addr);
    error InvalidContract(address contr);
    error InvalidImplementation(address addr);
    error AlreadyInitialized();
}
