//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/UUPSImplementation.sol";

contract ImplementationMockA is UUPSImplementation {
    uint private _a;

    function setA(uint newA) external {
        _a = newA;
    }

    function getA() external view returns (uint) {
        return _a;
    }
}
