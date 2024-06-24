//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library SplitAccountConfiguration {
    // --- Constants --- //

    bytes32 private constant GLOBAL_DATA_SLOT_NAME =
        keccak256(abi.encode("io.synthetix.bfp-market.SplitAccountConfiguration"));

    // --- Storage --- //

    struct GlobalData {
        /// {address => isEnabled}.
        mapping(address => bool) whitelisted;
        /// Array of whitelisted addresses (use whitelisted mapping).
        address[] whitelistedAddresses;
    }

    function load() internal pure returns (SplitAccountConfiguration.GlobalData storage d) {
        bytes32 s = GLOBAL_DATA_SLOT_NAME;
        assembly {
            d.slot := s
        }
    }
}
