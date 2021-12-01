//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAddressError {
    error ZeroAddress(address addr);
    error NotAContract(address contr);
}
