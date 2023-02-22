//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {UUPSProxyWithOwner} from "@synthetixio/core-contracts/contracts/proxy/UUPSProxyWithOwner.sol";

/**
 * Synthetix V3 Official Proxy Contract
 * 
 * If you are wondering how to interact with this contract or what functions are available, you can
 * view and download the full, up-to-date ABI implementation, list of implementation contracts, 
 * and a UI for reading/writing the proxy at https://usecannon.com/packages/synthetix/interact
 */
contract Proxy is UUPSProxyWithOwner {
    // solhint-disable-next-line no-empty-blocks
    constructor(
        address firstImplementation,
        address initialOwner
    ) UUPSProxyWithOwner(firstImplementation, initialOwner) {}
}
