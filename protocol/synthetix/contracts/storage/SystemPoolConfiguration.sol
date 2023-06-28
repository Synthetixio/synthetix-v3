//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

/**
 * @title System wide configuration for pools.
 */
library SystemPoolConfiguration {
    bytes32 private constant _SLOT_SYSTEM_POOL_CONFIGURATION =
        keccak256(abi.encode("io.synthetix.synthetix.SystemPoolConfiguration"));

    struct Data {
        /**
         * @dev Owner specified system-wide limiting factor that prevents markets from minting too much debt, similar to the issuance ratio to a collateral type.
         *
         * Note: If zero, then this value defaults to 100%.
         */
        uint256 minLiquidityRatioD18;
        uint128 __reservedForFutureUse;
        /**
         * @dev Id of the main pool set by the system owner.
         */
        uint128 preferredPool;
        /**
         * @dev List of pools approved by the system owner.
         */
        SetUtil.UintSet approvedPools;
    }

    /**
     * @dev Returns the configuration singleton.
     */
    function load() internal pure returns (Data storage systemPoolConfiguration) {
        bytes32 s = _SLOT_SYSTEM_POOL_CONFIGURATION;
        assembly {
            systemPoolConfiguration.slot := s
        }
    }
}
