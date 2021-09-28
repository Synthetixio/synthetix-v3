//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract ImplementationMockA {
    uint _a;

    function setA(uint newA) external {
        _a = newA;
    }

    function getA() external view returns (uint) {
        return _a;
    }
}

