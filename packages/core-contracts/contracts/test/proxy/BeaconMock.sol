//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/Beacon.sol";

contract BeaconMock is Beacon {
    function setImplementation(address newImplementation) public {
        _setImplementation(newImplementation);
    }
}
