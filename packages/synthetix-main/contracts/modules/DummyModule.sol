//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract DummyModule {
    function echo(uint value) public pure returns (uint) {
        return value;
    }
}
