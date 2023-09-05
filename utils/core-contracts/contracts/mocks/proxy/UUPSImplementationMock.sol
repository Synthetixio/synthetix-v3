//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../proxy/UUPSImplementation.sol";

contract UUPSImplementationMock is UUPSImplementation {
    // solhint-disable-next-line payable/only-payable
    function upgradeTo(address newImplementation) public override {
        _upgradeTo(newImplementation);
    }
}
