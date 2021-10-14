//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

abstract contract OwnableMixin {
    error OnlyOwnerAllowed();

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != _getOwner()) {
            revert OnlyOwnerAllowed();
        }
    }

    modifier onlyOwnerIfSet() {
        address owner = _getOwner();
        if (owner != address(0) && msg.sender != owner) {
            revert OnlyOwnerAllowed();
        }
        _;
    }

    function _getOwner() internal view virtual returns (address);
}
