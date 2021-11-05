//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/ForwardingProxy.sol";

contract ForwardingProxyMock is ForwardingProxy {
    function getImplementation() external view returns (address) {
        return _getImplementation();
    }

    function initialize(address firstImplementation) external {
        _setImplementation(firstImplementation);
    }
}
