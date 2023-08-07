//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastI256, SafeCastU256, SafeCastI128, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {MathUtil} from "../utils/MathUtil.sol";

library Position {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastU128 for uint128;
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using DecimalMath for int128;
    using PerpsMarket for PerpsMarket.Data;

    struct Data {
        uint128 marketId;
        int128 size;
        uint128 latestInteractionPrice;
        int128 latestInteractionFunding;
    }

    function update(Data storage self, Data memory newPosition) internal {
        self.size = newPosition.size;
        self.marketId = newPosition.marketId;
        self.latestInteractionPrice = newPosition.latestInteractionPrice;
        self.latestInteractionFunding = newPosition.latestInteractionFunding;
    }

    function clear(Data storage self) internal {
        self.size = 0;
        self.latestInteractionPrice = 0;
        self.latestInteractionFunding = 0;
    }

    function getPositionData(
        Data storage self,
        uint price
    )
        internal
        view
        returns (
            uint256 notionalValue,
            int totalPnl,
            int pricePnl,
            int accruedFunding,
            int netFundingPerUnit,
            int nextFunding
        )
    {
        (totalPnl, pricePnl, accruedFunding, netFundingPerUnit, nextFunding) = getPnl(self, price);
        notionalValue = getNotionalValue(self, price);
    }

    function getPnl(
        Data storage self,
        uint price
    )
        internal
        view
        returns (
            int totalPnl,
            int pricePnl,
            int accruedFunding,
            int netFundingPerUnit,
            int nextFunding
        )
    {
        nextFunding = PerpsMarket.load(self.marketId).calculateNextFunding(price);
        netFundingPerUnit = nextFunding - self.latestInteractionFunding;
        accruedFunding = self.size.mulDecimal(netFundingPerUnit);

        int priceShift = price.toInt() - self.latestInteractionPrice.toInt();
        pricePnl = self.size.mulDecimal(priceShift);
        totalPnl = pricePnl + accruedFunding;
    }

    function getNotionalValue(Data storage self, uint256 price) internal view returns (uint256) {
        return MathUtil.abs(self.size).mulDecimal(price);
    }
}
