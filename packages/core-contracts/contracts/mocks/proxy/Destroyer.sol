//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract Destroyer {
    address private _implementation;

    function upgradeTo(address) public {
        _implementation = address(0);

        selfdestruct(payable(0));
    }
}
