//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";
import {InterestRate} from "./InterestRate.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {BaseQuantoPerUSDInt128, USDPerBaseUint256, USDPerBaseUint128, USDPerBaseInt256, QuantoUint256, QuantoInt256, InteractionsBaseQuantoPerUSDInt128, InteractionsBaseQuantoPerUSDInt256, InteractionsUSDPerBaseUint256, InteractionsUSDPerBaseUint128, BaseQuantoPerUSDInt256, InteractionsQuantoUint256} from '@kwenta/quanto-dimensions/src/UnitTypes.sol';

library Position {
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;
    using DecimalMath for uint256;
    using DecimalMath for int128;
    using PerpsMarket for PerpsMarket.Data;
    using InterestRate for InterestRate.Data;
    using InteractionsBaseQuantoPerUSDInt128 for BaseQuantoPerUSDInt128;
    using InteractionsBaseQuantoPerUSDInt256 for BaseQuantoPerUSDInt256;
    using InteractionsUSDPerBaseUint256 for USDPerBaseUint256;
    using InteractionsUSDPerBaseUint128 for USDPerBaseUint128;
    using InteractionsQuantoUint256 for QuantoUint256;

    struct Data {
        uint128 marketId;
        BaseQuantoPerUSDInt128 size;
        USDPerBaseUint128 latestInteractionPrice;
        uint256 latestInterestAccrued;
        int128 latestInteractionFunding;
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
        USDPerBaseUint256 price
    )
        internal
        view
        returns (
            QuantoUint256 notionalValue,
            QuantoInt256 totalPnl,
            QuantoInt256 pricePnl,
            QuantoUint256 chargedInterest,
            QuantoInt256 accruedFunding,
            USDPerBaseInt256 netFundingPerUnit,
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
        USDPerBaseUint256 price
    )
        internal
        view
        returns (
            QuantoInt256 totalPnl,
            QuantoInt256 pricePnl,
            QuantoUint256 chargedInterest,
            QuantoInt256 accruedFunding,
            USDPerBaseInt256 netFundingPerUnit,
            int256 nextFunding
        )
    {
        nextFunding = PerpsMarket.load(self.marketId).calculateNextFunding(price);
        netFundingPerUnit = USDPerBaseInt256.wrap(nextFunding - self.latestInteractionFunding);
        accruedFunding = self.size.to256().mulDecimalToQuanto(netFundingPerUnit);

        USDPerBaseInt256 priceShift = price.toInt() - self.latestInteractionPrice.to256().toInt();
        pricePnl = self.size.to256().mulDecimalToQuanto(priceShift);

        chargedInterest = interestAccrued(self, price);

        totalPnl = pricePnl + accruedFunding - chargedInterest.toInt();
    }

    function interestAccrued(
        Data storage self,
        USDPerBaseUint256 price
    ) internal view returns (QuantoUint256 chargedInterest) {
        uint256 nextInterestAccrued = InterestRate.load().calculateNextInterest();
        uint256 netInterestPerQuantoUnit = nextInterestAccrued - self.latestInterestAccrued;

        // The interest is charged pro-rata on this position's contribution to the locked OI requirement
        chargedInterest = getLockedNotionalValue(self, price).mulDecimal(netInterestPerQuantoUnit);
    }

    function getLockedNotionalValue(
        Data storage self,
        USDPerBaseUint256 price
    ) internal view returns (QuantoUint256) {
        return
            getNotionalValue(self, price).mulDecimal(
                PerpsMarketConfiguration.load(self.marketId).lockedOiRatioD18
            );
    }

    function getNotionalValue(Data storage self, USDPerBaseUint256 price) internal view returns (QuantoUint256) {
        return QuantoUint256.wrap(MathUtil.abs(self.size.unwrap()).mulDecimal(price.unwrap()));
    }
}
