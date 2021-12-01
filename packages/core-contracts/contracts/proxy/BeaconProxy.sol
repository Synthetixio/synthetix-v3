// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AbstractProxy.sol";
import "./BeaconStorage.sol";
import "../interfaces/IAddressError.sol";
import "../interfaces/IBeacon.sol";
import "../utils/ContractUtil.sol";

contract BeaconProxy is AbstractProxy, BeaconStorage, ContractUtil {
    event BeaconSet(address beacon);

    constructor(address firstBeacon) {
        _setBeacon(firstBeacon);
    }

    function _getImplementation() internal view override returns (address) {
        return IBeacon(_getBeacon()).getImplementation();
    }

    function _setBeacon(address newBeacon) internal virtual {
        if (newBeacon == address(0)) {
            revert IAddressError.ZeroAddress(newBeacon);
        }

        if (!_isContract(newBeacon)) {
            revert IAddressError.NotAContract(newBeacon);
        }

        _beaconStore().beacon = newBeacon;

        emit BeaconSet(newBeacon);
    }

    function _getBeacon() internal view virtual returns (address) {
        return _beaconStore().beacon;
    }
}
