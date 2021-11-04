//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../ownership/Ownable.sol";

contract OwnableMock is Ownable {
    constructor(address firstOwner) {
        _setOwner(firstOwner);

        emit OwnerChanged(address(0), firstOwner);
    }
}
