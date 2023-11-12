//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";

library InterestRate {
    using DecimalMath for uint256;
    using DecimalMath for uint128;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    // 4 years which includes leap
    uint256 private constant AVERAGE_SECONDS_PER_YEAR = 31557600;

    bytes32 private constant _SLOT_INTEREST_RATE =
        keccak256(abi.encode("io.synthetix.perps-market.InterestRate"));

    struct Data {
        uint256 interestAccrued; // per $1 of OI
        uint128 interestRate;
        uint256 lastTimestamp;
        uint256 unrealizedInterestRate;
    }

    function load() internal pure returns (Data storage interestRate) {
        bytes32 s = _SLOT_INTEREST_RATE;
        assembly {
            interestRate.slot := s
        }
    }

    function update() internal returns (uint256 currentInterestAccrued) {
        Data storage self = load();

        (
            uint128 lowUtilizationInterestRateGradient,
            uint128 interestRateGradientBreakpoint,
            uint128 highUtilizationInterestRateGradient
        ) = GlobalPerpsMarketConfiguration.loadInterestRateParameters();

        // interest rate not enabled
        if (lowUtilizationInterestRateGradient == 0) {
            return 0;
        }

        self.interestAccrued = calculateNextInterest(self);

        self.interestRate = currentInterestRate(
            lowUtilizationInterestRateGradient,
            interestRateGradientBreakpoint,
            highUtilizationInterestRateGradient
        );
        self.lastTimestamp = block.timestamp;

        return self.interestAccrued;
    }

    function proportionalElapsed(Data storage self) internal view returns (uint128) {
        return (block.timestamp - self.lastTimestamp).divDecimal(AVERAGE_SECONDS_PER_YEAR).to128();
    }

    function calculateNextInterest(Data storage self) internal view returns (uint256) {
        return self.interestAccrued + unrecordedInterest(self);
    }

    function unrecordedInterest(Data storage self) internal view returns (uint256) {
        return self.interestRate.mulDecimalUint128(proportionalElapsed(self)).to256();
    }

    function currentInterestRate(
        uint128 lowUtilizationInterestRateGradient,
        uint128 interestRateGradientBreakpoint,
        uint128 highUtilizationInterestRateGradient
    ) internal view returns (uint128) {
        uint128 currentUtilizationRate = PerpsMarketFactory.load().utilizationRate();

        // if utilization rate is below breakpoint, multiply low utilization * # of percentage points of utilizationRate
        // otherwise multiply low utilization until breakpoint, then use high utilization gradient for the rest
        if (currentUtilizationRate < interestRateGradientBreakpoint) {
            return
                lowUtilizationInterestRateGradient.mulDecimalUint128(currentUtilizationRate) * 100;
        } else {
            uint128 highUtilizationRate = currentUtilizationRate - interestRateGradientBreakpoint;
            uint128 highUtilizationRateInterest = highUtilizationInterestRateGradient
                .mulDecimalUint128(highUtilizationRate) * 100;
            uint128 lowUtilizationRateInterest = lowUtilizationInterestRateGradient
                .mulDecimalUint128(interestRateGradientBreakpoint) * 100;
            return highUtilizationRateInterest + lowUtilizationRateInterest;
        }
    }
}
