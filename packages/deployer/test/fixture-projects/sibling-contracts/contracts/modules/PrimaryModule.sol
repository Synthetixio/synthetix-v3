//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract PrimaryModule {
    function getNumber() public pure virtual returns (uint) {
        return 100;
    }
}
