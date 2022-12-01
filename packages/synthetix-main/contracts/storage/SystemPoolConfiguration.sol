//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

/**
 * @title TODO
/// @notice returns the liquidity ratio cap for delegation of liquidity by pools to markets
/// @notice places a cap on what proportion of free vault liquidity may be used towards a pool. only owner.
 *
 * This is a global configuration object. I.e. there is only one of these.
 *
 * TODO: Rename to SystemsPoolConfiguration.
 */
library SystemPoolConfiguration {
    struct Data {
        /**
         * @dev Owner specified system-wide limiting factor that prevents markets from minting too much debt, similar to the issuance ratio to a collateral type.
         *
         * Note: If zero, then this value defaults to 100%.
         */
        uint minLiquidityRatioD18;
        /**
         * @dev Id of the main pool set by the system owner.
         */
        uint preferredPool;
        /**
         * @dev List of pools approved by the system owner.
         */
        SetUtil.UintSet approvedPools;
    }

    /**
     * @dev TODO
     */
    function load() internal pure returns (Data storage data) {
        bytes32 s = keccak256(abi.encode("PoolConfiguration"));
        assembly {
            data.slot := s
        }
    }
}
