//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {MathUtil} from "../utils/MathUtil.sol";

library SettlementStrategy {
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    struct Data {
        /**
         * @dev see Type for more details
         */
        Type strategyType;
        /**
         * @dev the delay added to commitment time after which committed orders can be settled.
         * @dev this ensures settlements aren't on the same block as commitment.
         */
        uint256 settlementDelay;
        /**
         * @dev the duration of the settlement window, after which committed orders can be cancelled.
         */
        uint256 settlementWindowDuration;
        /**
         * @dev the address of the contract that returns the benchmark price at a given timestamp
         * @dev generally this contract orchestrates the erc7412 logic to force push an offchain price for a given timestamp.
         */
        address priceVerificationContract; // For Chainlink and Pyth settlement strategies
        /**
         * @dev configurable feed id for chainlink and pyth
         */
        bytes32 feedId;
        /**
         * @dev the amount of reward paid to the keeper for settling the order.
         */
        uint256 settlementReward;
        /**
         * @dev whether the strategy is disabled or not.
         */
        bool disabled;
        /**
         * @dev the delay added to commitment time for determining valid price. Defines the expected price timestamp.
         * @dev this ensures price aren't on the same block as commitment in case of blockchain drift in timestamp or bad actors timestamp manipulation.
         */
        uint256 commitmentPriceDelay;
    }

    enum Type {
        PYTH
    }
}
