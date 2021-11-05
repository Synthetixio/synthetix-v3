// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./AbstractProxy.sol";
import "../interfaces/IBeacon.sol";

abstract contract BeaconProxy is AbstractProxy {
    function _getImplementation() internal view override returns (address) {
        return IBeacon(getBeacon()).getImplementation();
    }

    function _setImplementation(address newImplementation) internal override {
        IBeacon(getBeacon()).setImplementation(newImplementation);
    }

    // solhint-disable-next-line no-empty-blocks
    function getBeacon() public view virtual returns (address);
}
