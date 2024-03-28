//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";
import {InterestRate} from "./InterestRate.sol";
import {MathUtil} from "../utils/MathUtil.sol";

library Position {
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;
    using DecimalMath for uint256;
    using DecimalMath for int128;
    using PerpsMarket for PerpsMarket.Data;
    using InterestRate for InterestRate.Data;

    struct Data {
        uint128 marketId;
        int128 size;
        uint128 latestInteractionPrice;
        int128 latestInteractionFunding;
        uint256 latestInterestAccrued;
    }

    function update(
        Data storage self,
        Data memory newPosition,
        uint256 latestInterestAccrued
    ) internal {
        self.size = newPosition.size;
        self.marketId = newPosition.marketId;
        self.latestInteractionPrice = newPosition.latestInteractionPrice;
        self.latestInteractionFunding = newPosition.latestInteractionFunding;
        self.latestInterestAccrued = latestInterestAccrued;
    }

    function getPositionData(
        Data storage self,
        uint256 price
    )
        internal
        view
        returns (
            uint256 notionalValue,
            int256 totalPnl,
            int256 pricePnl,
            uint256 chargedInterest,
            int256 accruedFunding,
            int256 netFundingPerUnit,
            int256 nextFunding
        )
    {
        (
            totalPnl,
            pricePnl,
            chargedInterest,
            accruedFunding,
            netFundingPerUnit,
            nextFunding
        ) = getPnl(self, price);
        notionalValue = getNotionalValue(self, price);
    }

    function getPnl(
        Data storage self,
        uint256 price
    )
        internal
        view
        returns (
            int256 totalPnl,
            int256 pricePnl,
            uint256 chargedInterest,
            int256 accruedFunding,
            int256 netFundingPerUnit,
            int256 nextFunding
        )
    {
        nextFunding = PerpsMarket.load(self.marketId).calculateNextFunding(price);
        netFundingPerUnit = nextFunding - self.latestInteractionFunding;
        accruedFunding = self.size.mulDecimal(netFundingPerUnit);

        int256 priceShift = price.toInt() - self.latestInteractionPrice.toInt();
        pricePnl = self.size.mulDecimal(priceShift);

        chargedInterest = interestAccrued(self, price);

        totalPnl = pricePnl + accruedFunding - chargedInterest.toInt();
    }

    function interestAccrued(
        Data storage self,
        uint256 price
    ) internal view returns (uint256 chargedInterest) {
        uint256 nextInterestAccrued = InterestRate.load().calculateNextInterest();
        uint256 netInterestPerDollar = nextInterestAccrued - self.latestInterestAccrued;

        // The interest is charged pro-rata on this position's contribution to the locked OI requirement
        chargedInterest = getLockedNotionalValue(self, price).mulDecimal(netInterestPerDollar);
    }

    function getLockedNotionalValue(
        Data storage self,
        uint256 price
    ) internal view returns (uint256) {
        return
            getNotionalValue(self, price).mulDecimal(
                PerpsMarketConfiguration.load(self.marketId).lockedOiRatioD18
            );
    }

    function getNotionalValue(Data storage self, uint256 price) internal view returns (uint256) {
        return MathUtil.abs(self.size).mulDecimal(price);
    }
}
