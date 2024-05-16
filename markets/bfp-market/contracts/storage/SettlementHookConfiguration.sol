//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library SettlementHookConfiguration {
    // --- Constants --- //

    bytes32 private constant SLOT_NAME =
        keccak256(abi.encode("io.synthetix.bfp-market.SettlementHookConfiguration"));

    // --- Storage --- //

    struct GlobalData {
        /// {hookAddress => isEnabled}.
        mapping(address => bool) whitelisted;
        /// Array of whitelisted hook contract addresses (use whitelisted mapping).
        address[] whitelistedHookAddresses;
        /// Maximum hooks that can be specified during an order commitment.
        uint32 maxHooksPerOrder;
        uint64 __unused1;
        uint64 __unused2;
        uint96 __unused3;
    }

    function load() internal pure returns (SettlementHookConfiguration.GlobalData storage d) {
        bytes32 s = SLOT_NAME;
        assembly {
            d.slot := s
        }
    }
}
