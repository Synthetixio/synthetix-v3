//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/BeaconProxy.sol";

contract BeaconProxyMock is BeaconProxy {
    // solhint-disable-next-line no-empty-blocks
    constructor(address firstBeacon) BeaconProxy(firstBeacon) {}

    function setBeacon(address newBeacon) external {
        _setBeacon(newBeacon);
    }

    function getBeacon() external view returns (address) {
        return _getBeacon();
    }
}
