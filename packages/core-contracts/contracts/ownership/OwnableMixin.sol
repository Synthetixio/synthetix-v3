//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

abstract contract OwnableMixin {
    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        require(msg.sender == _getOwner(), "Only owner can invoke");
    }

    modifier onlyOwnerIfSet() {
        address owner = _getOwner();
        if (owner != address(0)) {
            require(msg.sender == owner, "Only owner can invoke");
        }
        _;
    }

    function _getOwner() internal virtual view returns (address);
}
