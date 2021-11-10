// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BeaconStorage.sol";
import "../common/CommonErrors.sol";
import "../utils/ContractUtil.sol";

contract Beacon is BeaconStorage, ContractUtil, CommonErrors {
    event Upgraded(address implementation);

    function _setImplementation(address newImplementation) internal virtual {
        if (newImplementation == address(0)) {
            revert InvalidAddress(newImplementation);
        }

        if (!_isContract(newImplementation)) {
            revert InvalidContract(newImplementation);
        }

        _beaconStore().implementation = newImplementation;

        emit Upgraded(newImplementation);
    }

    function getImplementation() external view returns (address) {
        return _beaconStore().implementation;
    }
}
