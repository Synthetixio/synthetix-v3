// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BeaconStorage.sol";
import "../ownership/OwnableMixin.sol";
import "../utils/ContractUtil.sol";
import "../interfaces/IBeacon.sol";
import "../errors/AddressError.sol";

contract Beacon is IBeacon, OwnableMixin, BeaconStorage, ContractUtil {
    event Upgraded(address implementation);

    constructor(address firstOwner) {
        _ownableStore().owner = firstOwner;
    }

    function upgradeTo(address newImplementation) external override onlyOwner {
        if (newImplementation == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (!_isContract(newImplementation)) {
            revert AddressError.NotAContract(newImplementation);
        }

        _beaconStore().implementation = newImplementation;

        emit Upgraded(newImplementation);
    }

    function getImplementation() external view override returns (address) {
        return _beaconStore().implementation;
    }
}
