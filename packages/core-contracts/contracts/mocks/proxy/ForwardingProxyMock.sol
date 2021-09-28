//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../proxy/ForwardingProxy.sol";

contract ForwardingProxyMock is ForwardingProxy {
    bytes32 __SLOT_0;
    bytes32 __SLOT_1;
    bytes32 __SLOT_2;
    bytes32 __SLOT_3;
    bytes32 __SLOT_4;
    bytes32 __SLOT_5;
    bytes32 __SLOT_6;
    bytes32 __SLOT_7;
    bytes32 __SLOT_8;
    bytes32 __SLOT_9;

    address _implementation;

    constructor(address firstImplementation) ForwardingProxy(firstImplementation) {}

    function setImplementation(address newImplementation) external {
        _setImplementation(newImplementation);
    }

    function getImplementation() external view returns (address) {
        return _getImplementation();
    }

    function _setImplementation(address newImplementation) internal override {
        _implementation = newImplementation;
    }

    function _getImplementation() internal override view returns (address) {
        return _implementation;
    }
}

