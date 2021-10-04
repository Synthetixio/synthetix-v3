//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../proxy/ForwardingProxy.sol";
import "../storage/ProxyStorageMock.sol";

contract UniversalProxyMock is ForwardingProxy, ProxyStorageMock {
    // solhint-disable-next-line no-empty-blocks
    constructor(address firstImplementation) ForwardingProxy(firstImplementation) {}

    function setImplementation(address newImplementation) external {
        _setImplementation(newImplementation);
    }

    function getImplementation() external view returns (address) {
        return _getImplementation();
    }

    function _setImplementation(address newImplementation) internal override {
        _setProxyStorageImplementation(newImplementation);
    }

    function _getImplementation() internal view override returns (address) {
        return _getProxyStorageImplementation();
    }
}
