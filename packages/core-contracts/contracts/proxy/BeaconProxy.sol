// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ForwardingProxy.sol";
import "../common/CommonErrors.sol";
import "../interfaces/IBeacon.sol";
import "../ownership/OwnableMixin.sol";
import "../utils/ContractUtil.sol";

abstract contract BeaconProxy is ForwardingProxy {
    function _getBeacon() internal view virtual returns (address) {}

    function _getImplementation() internal view override returns (address) {
        return IBeacon(_getBeacon()).getImplementation();
    }

    // the implementation can be set only by the Beacon
    function _setImplementation(address newImplementation) internal override {}
}
