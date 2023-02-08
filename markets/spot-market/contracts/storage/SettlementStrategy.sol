//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "hardhat/console.sol";

library SettlementStrategy {
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    error PriceDeviationToleranceExceeded(uint256 deviation, uint tolerance);

    struct Data {
        Type strategyType;
        uint256 settlementDelay;
        uint256 settlementWindowDuration;
        address priceVerificationContract; // For Chainlink and Pyth settlement strategies
        bytes32 feedId;
        string url;
        uint256 settlementReward;
        uint256 priceDeviationTolerance;
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
