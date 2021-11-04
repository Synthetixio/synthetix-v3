//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/UUPSImplementation.sol";

contract UUPSImplementationMockB is UUPSImplementation {
    uint private _a;
    bytes32 private _b;

    function setA(uint newA) external payable {
        _a = newA;
    }

    function getA() external view returns (uint) {
        return _a;
    }

    function setB(bytes32 newB) external {
        _b = newB;
    }

    function getB() external view returns (bytes32) {
        return _b;
    }
}
