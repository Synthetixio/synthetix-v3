//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

library SettlementStrategy {
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    error PriceDeviationToleranceExceeded(uint256 deviation, uint tolerance);

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
        address priceVerificationContract; // For Chainlink and Pyth settlement strategies
        /**
         * @dev configurable feed id for chainlink and pyth
         */
        bytes32 feedId;
        /**
         * @dev gateway url for pyth/chainlink to retrieve offchain prices
         */
        string url;
        /**
         * @dev the amount of reward paid to the keeper for settling the order.
         */
        uint256 settlementReward;
        /**
         * @dev the % deviation from onchain price that is allowed for offchain settlement.
         */
        uint256 priceDeviationTolerance;
        /**
         * @dev whether the strategy is disabled or not.
         */
        bool disabled;
    }

    enum Type {
        ONCHAIN,
        CHAINLINK,
        PYTH
    }

    function checkPriceDeviation(
        Data storage strategy,
        uint offchainPrice,
        uint onchainPrice
    ) internal view {
        int priceDeviation = abs(offchainPrice.toInt() - onchainPrice.toInt());
        uint priceDeviationPercentage = abs(priceDeviation).toUint().divDecimal(onchainPrice);

        if (priceDeviationPercentage > strategy.priceDeviationTolerance) {
            revert PriceDeviationToleranceExceeded(
                priceDeviationPercentage,
                strategy.priceDeviationTolerance
            );
        }
    }

    function abs(int x) private pure returns (int) {
        return x >= 0 ? x : -x;
    }
}
