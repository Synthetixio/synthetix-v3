//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../BaseProxy.sol";

contract BaseProxyMock is BaseProxy {
    // solhint-disable-next-line no-empty-blocks
    constructor(address firstImplementation) BaseProxy(firstImplementation) {}

    // solhint-disable-next-line private-vars-leading-underscore
    function __setImplementation(address newImplementation) public {
        _setImplementation(newImplementation);
    }

    // solhint-disable-next-line private-vars-leading-underscore
    function __getImplementation() public view returns (address) {
        return _getImplementation();
    }
}
