//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract OwnableMixin {
    error OnlyOwnerAllowed();

    struct OwnerNamespace {
        address owner;
        address nominatedOwner;
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier onlyOwnerIfSet() {
        address owner = _getOwner();
        if (owner != address(0) && msg.sender != owner) {
            revert OnlyOwnerAllowed();
        }
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != _getOwner()) {
            revert OnlyOwnerAllowed();
        }
    }

    function _ownerStorage() internal pure returns (OwnerNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.owner")) - 1)
            store.slot := 0x1f33674ed9c09f309c0798b8fcbe9c48911f48b2defee8aecb930c5ef6f80e37
        }
    }

    function _getOwner() internal view returns (address) {
        return _ownerStorage().owner;
    }
}
