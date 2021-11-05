//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./OwnableStorage.sol";

contract OwnableMixin is OwnableStorage {
    error OnlyOwnerAllowed();

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier onlyOwnerIfSet() {
        address owner = _getOwner();
        // if owner is set then check if msg.sender is the owner
        if (owner != address(0)) {
            _onlyOwner();
        }
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != _getOwner()) {
            revert OnlyOwnerAllowed();
        }
    }

    function _getOwner() internal view returns (address) {
        return _ownableStorage().owner;
    }
}
