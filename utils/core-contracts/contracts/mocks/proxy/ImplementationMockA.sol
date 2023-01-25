//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./UUPSImplementationMock.sol";

contract ImplementationMockA is UUPSImplementationMock {
    uint private _a;

    function setA(uint newA) external {
        _a = newA;
    }

    function getA() external view returns (uint) {
        return _a;
    }
}
