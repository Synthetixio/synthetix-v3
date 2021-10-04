//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../proxy/UniversalProxyImplementation.sol";
import "../storage/ProxyStorageMock.sol";

contract UniversalProxyImplementationMockA is UniversalProxyImplementation, ProxyStorageMock {
    uint private _a;

    function setA(uint newA) external {
        _a = newA;
    }

    function getA() external view returns (uint) {
        return _a;
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
