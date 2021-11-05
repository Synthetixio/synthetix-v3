// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BeaconStorage.sol";
import "../common/CommonErrors.sol";
import "../interfaces/IBeacon.sol";
import "../utils/ContractUtil.sol";

contract Beacon is IBeacon, BeaconStorage, ContractUtil, CommonErrors {
    event Upgraded(address indexed implementation);

    function getImplementation() external view override returns (address) {
        return _beaconStorage().implementation;
    }

    function _upgradeTo(address newImplementation) internal {
        if (newImplementation == _beaconStorage().implementation) {
            revert InvalidImplementation(newImplementation);
        }
        if (newImplementation == address(0)) {
            revert InvalidAddress(newImplementation);
        }
        if (!_isContract(newImplementation)) {
            revert InvalidContract(newImplementation);
        }
        _beaconStorage().implementation = newImplementation;
        emit Upgraded(newImplementation);
    }
}
