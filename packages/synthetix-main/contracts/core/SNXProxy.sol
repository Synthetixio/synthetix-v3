//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/ForwardingProxy.sol";
import "../storage/SNXStorage.sol";

contract SNXProxy is ForwardingProxy, SNXStorage {
    constructor(address firstImplementation) {
        _setImplementation(firstImplementation);
    }
}
