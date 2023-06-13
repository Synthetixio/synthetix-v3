//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title System wide configuration for accounts.
 */
library SystemAccountConfiguration {
    bytes32 private constant _SLOT_SYSTEM_ACCOUNT_CONFIGURATION =
        keccak256(abi.encode("io.synthetix.synthetix.SystemAccountConfiguration"));

    struct Data {
        /**
         * @dev Offset to use for auto-generated account IDs
         */
        uint64 accountIdOffset;
    }

    /**
     * @dev Returns the configuration singleton.
     */
    function load() internal pure returns (Data storage systemAccountConfiguration) {
        bytes32 s = _SLOT_SYSTEM_ACCOUNT_CONFIGURATION;
        assembly {
            systemAccountConfiguration.slot := s
        }
    }
}
