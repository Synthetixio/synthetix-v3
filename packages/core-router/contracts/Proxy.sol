//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {UUPSProxy} from "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";

contract Proxy is UUPSProxy {
    // solhint-disable-next-line no-empty-blocks
    constructor(address firstImplementation) UUPSProxy(firstImplementation) {}
}
