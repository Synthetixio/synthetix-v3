// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BeaconStorage.sol";
import "../ownership/OwnableMixin.sol";
import "../utils/AddressUtil.sol";
import "../errors/AddressError.sol";
import "../errors/ChangeError.sol";
import "../interfaces/IBeacon.sol";

contract Beacon is IBeacon, OwnableMixin, BeaconStorage {
    event Upgraded(address implementation);

    constructor(address firstOwner) {
        if (firstOwner == address(0)) {
            revert AddressError.ZeroAddress();
        }

        _ownableStore().owner = firstOwner;
    }

    function upgradeTo(address newImplementation) external override onlyOwner {
        if (newImplementation == address(0)) {
            revert AddressError.ZeroAddress();
        }

        BeaconStore storage store = _beaconStore();

        if (newImplementation == store.implementation) {
            revert ChangeError.NoChange();
        }

        if (!AddressUtil.isContract(newImplementation)) {
            revert AddressError.NotAContract(newImplementation);
        }

        store.implementation = newImplementation;

        emit Upgraded(newImplementation);
    }

    function getImplementation() external view override returns (address) {
        return _beaconStore().implementation;
    }
}
