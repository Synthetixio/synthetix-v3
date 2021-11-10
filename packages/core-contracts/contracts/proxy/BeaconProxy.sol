// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AbstractProxy.sol";
import "./Beacon.sol";
import "./BeaconStorage.sol";
import "../common/CommonErrors.sol";
import "../utils/ContractUtil.sol";

contract BeaconProxy is AbstractProxy, BeaconStorage, CommonErrors, ContractUtil {
    error NoChange();

    event BeaconSet(address beacon);

    constructor(address firstBeacon) {
        _setBeacon(firstBeacon);
    }

    function _getImplementation() internal view override returns (address) {
        return Beacon(_getBeacon()).getImplementation();
    }

    function _setBeacon(address newBeacon) internal virtual {
        if (newBeacon == address(0)) {
            revert InvalidAddress(newBeacon);
        }

        if (!_isContract(newBeacon)) {
            revert InvalidContract(newBeacon);
        }

        if (newBeacon == _beaconStore().beacon) {
            revert NoChange();
        }

        _beaconStore().beacon = newBeacon;
        emit BeaconSet(newBeacon);
    }

    function _getBeacon() internal view virtual returns (address) {
        return _beaconStore().beacon;
    }
}
