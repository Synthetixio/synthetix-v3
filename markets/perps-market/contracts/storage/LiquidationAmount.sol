//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Liquidation Amount Data
 */
library LiquidationAmount {
    struct Data {
        /**
         * @notice The timestamp of the last update to the liquidation amount
         */
        uint128 timestamp;
        /**
         * @notice The liquidation amount
         */
        uint128 amount;
    }
}
