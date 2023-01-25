//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

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

    function setB(string calldata newB) external payable {
        _b = newB;
    }

    function getB() external view returns (string memory) {
        return _b;
    }

    // solhint-disable-next-line no-empty-blocks
    fallback() external payable {}

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
