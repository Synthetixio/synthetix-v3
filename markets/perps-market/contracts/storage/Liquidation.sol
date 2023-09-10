//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Liquidation data used for determining max liquidation amounts
 */
library Liquidation {
    struct Data {
        /**
         * @dev Accumulated amount for this corresponding timestamp
         */
        uint128 amount;
        /**
         * @dev timestamp of the accumulated liqudation amount
         */
        uint256 timestamp;
    }
}
