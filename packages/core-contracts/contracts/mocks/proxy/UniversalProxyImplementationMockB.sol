//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../proxy/UniversalProxyImplementation.sol";
import "../storage/ProxyStorageMock.sol";

contract UniversalProxyImplementationMockB is UniversalProxyImplementation, ProxyStorageMock {
    uint private _a;
    string private _b;

    function setA(uint newA) external payable {
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

    function upgradeTo(address newImplementation) public override {
        _upgradeTo(newImplementation);
    }

    function _setImplementation(address newImplementation) internal override {
        _setProxyStorageImplementation(newImplementation);
    }

    function _getImplementation() internal view override returns (address) {
        return _getProxyStorageImplementation();
    }
}
