// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AbstractProxy.sol";
import "./BeaconStorage.sol";
import "../errors/AddressError.sol";
import "../errors/ChangeError.sol";
import "../interfaces/IBeacon.sol";
import "../utils/AddressUtil.sol";

contract BeaconProxy is AbstractProxy, BeaconStorage {
    event BeaconSet(address beacon);

    constructor(address firstBeacon) {
        _setBeacon(firstBeacon);
    }

    function _getImplementation() internal view override returns (address) {
        return IBeacon(_getBeacon()).getImplementation();
    }

    function _setBeacon(address newBeacon) internal virtual {
        BeaconStore storage store = _beaconStore();

        if (newBeacon == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (newBeacon == store.beacon) {
            revert ChangeError.NoChange();
        }

        if (!AddressUtil.isContract(newBeacon)) {
            revert AddressError.NotAContract(newBeacon);
        }

        store.beacon = newBeacon;

        emit BeaconSet(newBeacon);
    }

    function _getBeacon() internal view virtual returns (address) {
        return _beaconStore().beacon;
    }
}
