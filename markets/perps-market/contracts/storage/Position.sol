//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "./PerpsMarket.sol";

import "hardhat/console.sol";

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

    function updatePosition(Data storage self, Data memory newPosition) internal {
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
        uint128 marketId,
        uint price
    )
        internal
        view
        returns (
            int openInterest,
            int pnl,
            int accruedFunding,
            int netFundingPerUnit,
            int nextFunding
        )
    {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);

        nextFunding = perpsMarket.lastFundingValue + perpsMarket.unrecordedFunding(price);
        netFundingPerUnit = nextFunding - self.latestInteractionFunding;

        accruedFunding = self.size.mulDecimal(netFundingPerUnit);

        int priceShift = price.toInt() - self.latestInteractionPrice.toInt();
        pnl = self.size.mulDecimal(priceShift) + accruedFunding;

        openInterest = self.size.mulDecimal(price.toInt()) + accruedFunding;
    }
}
