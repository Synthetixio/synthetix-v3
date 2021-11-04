//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/UUPSImplementation.sol";

contract Bricker is UUPSImplementation {
    // function upgradeTo(address newImplementation) public override {
    //     if (_getImplementation() != newImplementation) {
    //         // _setSimulatingUpgrade(true);
    //         _setImplementation(newImplementation);
    //     }

    //     // if (_getSimulatingUpgrade()) {
    //     //     _setSimulatingUpgrade(false);
    //     // }
    // }
}
