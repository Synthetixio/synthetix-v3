// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BeaconStorage.sol";
import "../common/CommonErrors.sol";
import "../ownership/OwnableMixin.sol";
import "../utils/AddressUtil.sol";

contract Beacon is OwnableMixin, BeaconStorage, CommonErrors {
    event Upgraded(address implementation);

    constructor(address firstOwner) {
        _ownableStore().owner = firstOwner;
    }

    function upgradeTo(address newImplementation) external onlyOwner {
        if (newImplementation == address(0)) {
            revert InvalidAddress(newImplementation);
        }

        if (!AddressUtil.isContract(newImplementation)) {
            revert InvalidContract(newImplementation);
        }

        _beaconStore().implementation = newImplementation;

        emit Upgraded(newImplementation);
    }

    function getImplementation() external view returns (address) {
        return _beaconStore().implementation;
    }
}
