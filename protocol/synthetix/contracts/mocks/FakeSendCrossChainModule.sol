//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/CallUtil.sol";

/**
 * A module which can be added to the core system to allow it to call itself. Used for cross chain purposes, which rely on messages to self
 */
contract FakeSendCrossChainModule {
    function sendCrossChainFake(
        uint64[] memory targetChains,
        bytes memory data,
        uint256 gasLimit
    ) external returns (bytes32[] memory) {
        return new bytes32[](targetChains.length);
    }
}
