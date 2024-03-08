//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {MathUtil} from "../utils/MathUtil.sol";

library SettlementStrategy {
    using DecimalMath for uint256;
    using SafeCastU256 for uint256;

    error InvalidCommitmentAmount(uint256 minimumAmount, uint256 amount);

    struct Data {
        /**
         * @dev see Type.Data for more details
         */
        Type strategyType;
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
         * @dev the address of the contract that will verify the result data blob.
         * @dev used for pyth and chainlink offchain strategies.
         */
        address priceVerificationContract;
        /**
         * @dev configurable feed id for chainlink and pyth
         */
        bytes32 feedId;
        /**
         * @dev UNUSED (set to blank) - gateway url for pyth/chainlink to retrieve offchain prices
         */
        string url;
        /**
         * @dev the amount of reward paid to the keeper for settling the order.
         */
        uint256 settlementReward;
        /**
         * @dev UNUSED (set to 0) - the % deviation from onchain price that is allowed for offchain settlement.
         */
        uint256 priceDeviationTolerance;
        /**
         * @dev minimum amount of USD to be eligible for trade.
         * @dev this is to prevent inflation attacks where a user commits to selling a very small amount
         *      leading to shares divided by a very small number.
         * @dev in case this is not set properly, there is an extra layer of protection where the commitment reverts
         *      if the value of shares escrowed for trader is less than the committed amount (+ maxRoundingLoss)
         * @dev this value is enforced on both buys and sells, even though it's less of an issue on buy.
         */
        uint256 minimumUsdExchangeAmount;
        /**
         * @dev when converting from synth amount to shares, there's a small rounding loss on division.
         * @dev when shares are issued, we have a sanity check to ensure that the amount of shares is equal to the synth amount originally committed.
         * @dev the check would use the maxRoundingLoss by performing: calculatedSynthAmount + maxRoundingLoss >= committedSynthAmount
         * @dev only applies to ASYNC_SELL transaction where shares are issued.
         * @dev value is in native synth units
         */
        uint256 maxRoundingLoss;
        /**
         * @dev whether the strategy is disabled or not.
         */
        bool disabled;
    }

    enum Type {
        ONCHAIN,
        PYTH
    }

    function validateAmount(Data storage strategy, uint256 amount) internal view {
        uint256 minimumAmount = strategy.minimumUsdExchangeAmount + strategy.settlementReward;
        if (amount <= minimumAmount) {
            revert InvalidCommitmentAmount(minimumAmount, amount);
        }
    }
}
