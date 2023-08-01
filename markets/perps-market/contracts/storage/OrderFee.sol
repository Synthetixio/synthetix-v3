//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Orders Fee data
 */
library OrderFee {
    struct Data {
        /**
         * @dev Maker fee. Applied when order (or partial order) is reducing skew.
         */
        uint256 makerFee;
        /**
         * @dev Taker fee. Applied when order (or partial order) is increasing skew.
         */
        uint256 takerFee;
    }
}
