//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/OwnerNamespace.sol";

contract OwnerMixin is OwnerNamespace {
    /* MODIFIERS */

    modifier onlyOwner() {
        address owner = _ownerStorage().owner;
        if (owner != address(0)) {
            require(msg.sender == _ownerStorage().owner, "Only owner allowed");
        }
        _;
    }
}
