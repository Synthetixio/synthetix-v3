//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract Destroyer {
    bytes32 private _slot0;
    bytes32 private _slot1;
    bytes32 private _slot2;
    bytes32 private _slot3;
    bytes32 private _slot4;
    bytes32 private _slot5;
    bytes32 private _slot6;
    bytes32 private _slot7;
    bytes32 private _slot8;
    bytes32 private _slot9;

    address private _implementation;

    function upgradeTo(address) public {
        _implementation = address(0);

        selfdestruct(payable(0));
    }
}
