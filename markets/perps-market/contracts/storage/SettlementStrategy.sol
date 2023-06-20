//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library SettlementStrategy {
    struct Data {
        /**
         * @dev the delay added to commitment time for determining valid price window.
         * @dev this ensures settlements aren't on the same block as commitment.
         */
        uint256 settlementDelay;
        /**
         * @dev the duration of the settlement window, after which committed orders can be cancelled.
         */
        uint256 settlementWindowDuration;
        /**
         * @dev gateway url for pyth/chainlink to retrieve offchain prices
         */
        uint256 settlementReward;
    }
}
