//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/BeaconProxy.sol";

contract BeaconProxyMock is BeaconProxy {
    function setBeacon(address newImplementation) public {
        _setBeacon(newImplementation);
    }
}
