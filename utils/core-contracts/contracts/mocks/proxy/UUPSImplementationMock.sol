//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../proxy/UUPSImplementation.sol";

contract UUPSImplementationMock is UUPSImplementation {
    function upgradeTo(address newImplementation) public override {
        _upgradeTo(newImplementation);
    }
}
