//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";

/**
 * @title TODO
 */
library PoolConfiguration {
    struct Data {
        /**
         * @dev TODO
         */
        uint minLiquidityRatio;
        /**
         * @dev TODO
         */
        uint preferredPool;
        /**
         * @dev TODO
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
