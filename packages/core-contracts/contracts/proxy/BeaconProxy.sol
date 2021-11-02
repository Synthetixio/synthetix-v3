// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ForwardingProxy.sol";
import "../common/CommonErrors.sol";
import "../interfaces/IBeacon.sol";
import "../utils/ContractUtil.sol";

contract BeaconProxy is ForwardingProxy, ContractUtil, CommonErrors {
    event NewBeacon(address indexed newBeacon);

    struct BeaconSlot {
        address beaconAddress;
    }

    // solhint-disable-next-line no-empty-blocks
    function _getBeacon() internal view virtual returns (address) {
        return _beaconProxyStorage().beaconAddress;
    }

    function _getImplementation() internal view override returns (address) {
        return IBeacon(_getBeacon()).getImplementation();
    }

    // the implementation can be set only by the Beacon
    // solhint-disable-next-line no-empty-blocks
    function _setImplementation(address newImplementation) internal override {}

    function _setBeacon(address newBeacon) internal {
        if (newBeacon == address(0)) {
            revert InvalidAddress(newBeacon);
        }
        if (!_isContract(newBeacon)) {
            revert InvalidContract(newBeacon);
        }
        _beaconProxyStorage().beaconAddress = newBeacon;
        emit NewBeacon(newBeacon);
    }

    function _beaconProxyStorage() internal pure returns (BeaconSlot storage beacon) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.beaconproxy")) - 1)
            beacon.slot := 0x2395510979f6f33ca6b2853f771301ac5a746521967963945952ce833e51405c
        }
    }
}
