//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../modules/BeaconModule.sol";

contract BeaconModuleMock is BeaconModule {
    function setImplementation(address newImplementation) public {
        _setImplementation(newImplementation);
    }
}
