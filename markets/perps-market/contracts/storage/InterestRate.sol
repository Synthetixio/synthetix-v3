//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";

library InterestRate {
    using DecimalMath for uint256;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    // 4 years which includes leap
    uint256 private constant AVERAGE_SECONDS_PER_YEAR = 31556952;

    bytes32 private constant _SLOT_INTEREST_RATE =
        keccak256(abi.encode("io.synthetix.perps-market.InterestRate"));

    struct Data {
        uint256 currentRate;
        uint256 interestAccrued; // per $1 of OI
        uint256 interestRate;
        uint256 lastTimestamp;
        uint256 unrealizedInterestRate;
    }

    function load() internal pure returns (Data storage interestRate) {
        bytes32 s = _SLOT_INTEREST_RATE;
        assembly {
            interestRate.slot := s
        }
    }

    function update() internal {
        Data storage self = load();

        uint256 interest = self.interestRate.mulDecimal(proportionalElapsed(self));
        self.interestAccrued += interest;

        self.interestRate = currentInterestRate();
        self.lastTimestamp = block.timestamp;
    }

    function proportionalElapsed(Data storage self) internal view returns (uint) {
        return (block.timestamp - self.lastTimestamp).divDecimal(AVERAGE_SECONDS_PER_YEAR);
    }

    function currentInterestRate() internal view returns (uint256) {
        uint256 currentUtilizationRate = PerpsMarketFactory.load().utilizationRate();
        (
            uint256 lowUtilizationInterestRateGradient,
            uint256 interestRateGradientBreakpoint,
            uint256 highUtilizationInterestRateGradient
        ) = GlobalPerpsMarketConfiguration.loadInterestRateParameters();

        // if utilization rate is below breakpoint, multiply low utilization * # of percentage points of utilizationRate
        // otherwise multiply low utilization until breakpoint, then use high utilization gradient for the rest
        if (currentUtilizationRate < interestRateGradientBreakpoint) {
            return lowUtilizationInterestRateGradient.mulDecimal(currentUtilizationRate) * 100;
        } else {
            uint256 highUtilizationRate = currentUtilizationRate - interestRateGradientBreakpoint;
            uint256 highUtilizationRateInterest = highUtilizationInterestRateGradient.mulDecimal(
                highUtilizationRate
            ) * 100;
            uint256 lowUtilizationRateInterest = lowUtilizationInterestRateGradient.mulDecimal(
                interestRateGradientBreakpoint
            ) * 100;
            return highUtilizationRateInterest + lowUtilizationRateInterest;
        }
    }
}
