//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";

// solhint-disable-next-line no-empty-blocks
contract Proxy is UUPSProxy {
    constructor(address firstImplementation) UUPSProxy(firstImplementation) {}
}
