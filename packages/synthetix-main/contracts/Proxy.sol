//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/BaseProxy.sol";

contract Proxy is BaseProxy {
    // solhint-disable-next-line no-empty-blocks
    constructor(address firstImplementation) BaseProxy(firstImplementation) {}
}
