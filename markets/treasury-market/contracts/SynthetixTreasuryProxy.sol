//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {UUPSProxyWithOwner} from "@synthetixio/core-contracts/contracts/proxy/UUPSProxyWithOwner.sol";

/**
 * This is the  proxy for the Synthetix Treasury Market, a market for Synthetix v3.
 * For best results, you can interact with this contract, view its full source code in context and other implementation details via Cannon:
 * https://usecannon.com/packages/synthetix-treasury-market
 */
contract SynthetixTreasuryProxy is UUPSProxyWithOwner {
    // solhint-disable-next-line no-empty-blocks
    constructor(
        address firstImplementation,
        address initialOwner
    ) UUPSProxyWithOwner(firstImplementation, initialOwner) {}
}
