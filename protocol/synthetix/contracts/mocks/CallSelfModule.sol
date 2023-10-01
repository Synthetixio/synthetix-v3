//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/CallUtil.sol";

/**
 * A module which can be added to the core system to allow it to call itself. Used for cross chain purposes, which rely on messages to self
 */
contract CallSelfModule {
    using CallUtil for address;

    function callSelf(bytes memory selfCallData) external returns (bytes memory) {
        return address(this).tryCall(selfCallData);
    }
}
