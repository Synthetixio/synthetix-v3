//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./UUPSImplementationMock.sol";

contract ImplementationMockB is UUPSImplementationMock {
    uint private _a;
    string private _b;

    function setA(uint newA) external {
        _a = newA;
    }

    function getA() external view returns (uint) {
        return _a;
    }

    function setB(string calldata newB) external {
        _b = newB;
    }

    function getB() external view returns (string memory) {
        return _b;
    }
}
