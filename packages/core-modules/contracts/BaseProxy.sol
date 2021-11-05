//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/ForwardingProxy.sol";

contract BaseProxy is ForwardingProxy {
    constructor(address firstImplementation) {
        _setImplementation(firstImplementation);
    }
}
