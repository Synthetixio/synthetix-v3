//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256, SafeCastU128, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {GlobalPerpsMarket} from "./GlobalPerpsMarket.sol";
import {Position} from "./Position.sol";
import {PerpsPrice} from "./PerpsPrice.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";

library InterestRate {
    using DecimalMath for uint256;
    using DecimalMath for uint128;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using Position for Position.Data;
    // 4 year average which includes leap
    uint256 private constant AVERAGE_SECONDS_PER_YEAR = 31557600;

    bytes32 private constant _SLOT_INTEREST_RATE =
        keccak256(abi.encode("io.synthetix.perps-market.InterestRate"));

    struct Data {
        uint256 interestAccrued; // per $1 of OI
        uint128 interestRate;
        uint256 lastTimestamp;
    }

    function load() internal pure returns (Data storage interestRate) {
        bytes32 s = _SLOT_INTEREST_RATE;
        assembly {
            interestRate.slot := s
        }
    }

    function update(
        PerpsPrice.Tolerance priceTolerance
    ) internal returns (uint128 newInterestRate, uint256 currentInterestAccrued) {
        Data storage self = load();

        (
            uint128 lowUtilizationInterestRateGradient,
            uint128 interestRateGradientBreakpoint,
            uint128 highUtilizationInterestRateGradient
        ) = GlobalPerpsMarketConfiguration.loadInterestRateParameters();

        // if no interest parameters are set, interest rate is 0 and the interest accrued stays the same
        if (
            lowUtilizationInterestRateGradient == 0 &&
            interestRateGradientBreakpoint == 0 &&
            highUtilizationInterestRateGradient == 0
        ) {
            self.interestRate = 0;
            return (0, self.interestAccrued);
        }

        (uint128 currentUtilizationRate, , ) = GlobalPerpsMarket.load().utilizationRate(
            priceTolerance
        );

        self.interestAccrued = calculateNextInterest(self);

        self.interestRate = currentInterestRate(
            currentUtilizationRate,
            lowUtilizationInterestRateGradient,
            interestRateGradientBreakpoint,
            highUtilizationInterestRateGradient
        );
        self.lastTimestamp = block.timestamp;

        return (self.interestRate, self.interestAccrued);
    }

    function proportionalElapsed(Data storage self) internal view returns (uint128) {
        // even though timestamps here are not D18, divDecimal multiplies by 1e18 to preserve decimals into D18
        return (block.timestamp - self.lastTimestamp).divDecimal(AVERAGE_SECONDS_PER_YEAR).to128();
    }

    function calculateNextInterest(Data storage self) internal view returns (uint256) {
        return self.interestAccrued + unrecordedInterest(self);
    }

    function unrecordedInterest(Data storage self) internal view returns (uint256) {
        return self.interestRate.mulDecimalUint128(proportionalElapsed(self)).to256();
    }

    function currentInterestRate(
        uint128 currentUtilizationRate,
        uint128 lowUtilizationInterestRateGradient,
        uint128 interestRateGradientBreakpoint,
        uint128 highUtilizationInterestRateGradient
    ) internal pure returns (uint128 rate) {
        // if utilization rate is below breakpoint, multiply low utilization * # of percentage points of utilizationRate
        // otherwise multiply low utilization until breakpoint, then use high utilization gradient for the rest
        if (currentUtilizationRate < interestRateGradientBreakpoint) {
            rate =
                lowUtilizationInterestRateGradient.mulDecimalUint128(currentUtilizationRate) *
                100;
        } else {
            uint128 highUtilizationRate = currentUtilizationRate - interestRateGradientBreakpoint;
            uint128 highUtilizationRateInterest = highUtilizationInterestRateGradient
                .mulDecimalUint128(highUtilizationRate) * 100;
            uint128 lowUtilizationRateInterest = lowUtilizationInterestRateGradient
                .mulDecimalUint128(interestRateGradientBreakpoint) * 100;
            rate = highUtilizationRateInterest + lowUtilizationRateInterest;
        }
    }
}
