//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library SettlementHookConfiguration {
    // --- Constants --- //

    bytes32 private constant GLOBAL_DATA_SLOT_NAME =
        keccak256(abi.encode("io.synthetix.bfp-market.SettlementHookConfiguration"));

    // --- Storage --- //

    struct GlobalData {
        /// Maximum hooks that can be specified during an order commitment.
        uint32 maxHooksPerOrder;
        uint32 __unused1;
        uint64 __unused2;
        uint64 __unused3;
        uint64 __unused4;
        /// {hookAddress => isEnabled}.
        mapping(address => bool) whitelisted;
        /// Array of whitelisted hook contract addresses (use whitelisted mapping).
        address[] whitelistedHookAddresses;
    }

    function load() internal pure returns (SettlementHookConfiguration.GlobalData storage d) {
        bytes32 s = GLOBAL_DATA_SLOT_NAME;
        assembly {
            d.slot := s
        }
    }
}
