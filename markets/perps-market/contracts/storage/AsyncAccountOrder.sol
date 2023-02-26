//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "../utils/MathUtil.sol";
import "./Position.sol";
import "./PerpsMarket.sol";
import "./MarketConfiguration.sol";

library AsyncAccountOrder {
    using DecimalMath for int256;
    using DecimalMath for uint256;

    struct Data {
        int256 sizeDelta;
        uint256 settlementStrategyId;
        uint256 settlementTime;
        uint256 acceptablePrice;
        bytes32 trackingCode;
    }

    enum Status {
        Success,
        PriceOutOfBounds,
        CanLiquidate,
        MaxMarketValueExceeded,
        MaxLeverageExceeded,
        InsufficientMargin,
        NotPermitted,
        ZeroSizeOrder,
        AcceptablePriceExceeded,
        PositionFlagged
    }

    function simulateOrderSettlement(
        Data storage order,
        uint marketId,
        Position.Data storage oldPosition,
        uint256 orderPrice,
        MarketConfiguration.OrderType orderType
    ) internal returns (Position.Data memory newPosition, uint fees, Status status) {
        // Reverts if the user is trying to submit a size-zero order.
        if (order.sizeDelta == 0) {
            return (oldPosition, 0, Status.ZeroSizeOrder);
        }

        // The order is not submitted if the user's existing position needs to be liquidated.
        // if (_canLiquidate(oldPos, params.oraclePrice)) {
        //     return (oldPos, 0, Status.CanLiquidate);
        // }

        // calculate the total fee for exchange
        fee = orderFee(order, marketId, orderPrice, orderType);

        // Deduct the fee.
        // It is an error if the realised margin minus the fee is negative or subject to liquidation.
        (uint newMargin, Status status) = _recomputeMarginWithDelta(
            oldPos,
            params.fillPrice,
            -int(fee)
        );
        if (_isError(status)) {
            return (oldPos, 0, status);
        }

        // construct new position
        Position memory newPos = Position({
            id: oldPos.id,
            lastFundingIndex: uint64(_latestFundingIndex()),
            margin: uint128(newMargin),
            lastPrice: uint128(params.fillPrice),
            size: int128(int(oldPos.size).add(params.sizeDelta))
        });

        // always allow to decrease a position, otherwise a margin of minInitialMargin can never
        // decrease a position as the price goes against them.
        // we also add the paid out fee for the minInitialMargin because otherwise minInitialMargin
        // is never the actual minMargin, because the first trade will always deduct
        // a fee (so the margin that otherwise would need to be transferred would have to include the future
        // fee as well, making the UX and definition of min-margin confusing).
        bool positionDecreasing = _sameSide(oldPos.size, newPos.size) &&
            MathUtil.abs(newPos.size) < MathUtil.abs(oldPos.size);
        if (!positionDecreasing) {
            // minMargin + fee <= margin is equivalent to minMargin <= margin - fee
            // except that we get a nicer error message if fee > margin, rather than arithmetic overflow.
            if (uint(newPos.margin).add(fee) < _minInitialMargin()) {
                return (oldPos, 0, Status.InsufficientMargin);
            }
        }

        // check that new position margin is above liquidation margin
        // (above, in _recomputeMarginWithDelta() we checked the old position, here we check the new one)
        //
        // Liquidation margin is considered without a fee (but including premium), because it wouldn't make sense to allow
        // a trade that will make the position liquidatable.
        //
        // note: we use `oraclePrice` here as `liquidationPremium` calcs premium based not current skew.
        uint liqPremium = _liquidationPremium(newPos.size, params.oraclePrice);
        uint liqMargin = _liquidationMargin(newPos.size, params.oraclePrice).add(liqPremium);
        if (newMargin <= liqMargin) {
            return (newPos, 0, Status.CanLiquidate);
        }

        // Check that the maximum leverage is not exceeded when considering new margin including the paid fee.
        // The paid fee is considered for the benefit of UX of allowed max leverage, otherwise, the actual
        // max leverage is always below the max leverage parameter since the fee paid for a trade reduces the margin.
        // We'll allow a little extra headroom for rounding errors.
        {
            // stack too deep
            int leverage = int(newPos.size).multiplyDecimal(int(params.fillPrice)).divideDecimal(
                int(newMargin.add(fee))
            );
            if (_maxLeverage(_marketKey()).add(uint(_UNIT) / 100) < MathUtil.abs(leverage)) {
                return (oldPos, 0, Status.MaxLeverageExceeded);
            }
        }

        // Check that the order isn't too large for the markets.
        if (_orderSizeTooLarge(_maxMarketValue(_marketKey()), oldPos.size, newPos.size)) {
            return (oldPos, 0, Status.MaxMarketSizeExceeded);
        }

        return (newPos, fee, Status.Ok);
    }

    function orderFee(
        Data storage order,
        uint128 marketId,
        uint256 orderPrice,
        MarketConfiguration.OrderType orderType
    ) internal view returns (uint) {
        PerpsMarket.Data storage perpsMarketData = PerpsMarket.load(marketId);
        MarketConfiguration.Data storage marketConfig = MarketConfiguration.load(
            perpsMarketData.configId
        );
        // usd value of the difference in position (using the p/d-adjusted price).
        int marketSkew = perpsMarketData.skew;
        uint sizeDelta = order.sizeDelta;
        uint fillPrice = _fillPrice(
            marketId,
            perpsMarketData.skew,
            marketConfig.skewScale,
            order.sizeDelta,
            orderPrice
        );
        int notionalDiff = sizeDelta.multiplyDecimal(int(fillPrice));

        OrderFee.Data orderFeeData = marketConfig.orderFees[orderType];
        // does this trade keep the skew on one side?
        if (_sameSide(marketSkew + sizeDelta, marketSkew)) {
            // use a flat maker/taker fee for the entire size depending on whether the skew is increased or reduced.
            //
            // if the order is submitted on the same side as the skew (increasing it) - the taker fee is charged.
            // otherwise if the order is opposite to the skew, the maker fee is charged.

            uint staticRate = _sameSide(notionalDiff, marketSkew)
                ? orderFeeData.takerFee
                : orderFeeData.makerFee;
            return MathUtil.abs(notionalDiff.multiplyDecimal(int(staticRate)));
        }

        // this trade flips the skew.
        //
        // the proportion of size that moves in the direction after the flip should not be considered
        // as a maker (reducing skew) as it's now taking (increasing skew) in the opposite direction. hence,
        // a different fee is applied on the proportion increasing the skew.

        // proportion of size that's on the other direction
        uint takerSize = MathUtil.abs(
            (marketSkew + order.sizeDelta).divideDecimal(order.sizeDelta)
        );
        uint makerSize = DecimalMath.UNIT - takerSize;
        uint takerFee = MathUtil.abs(notionalDiff).mulDecimal(takerSize).mulDecimal(
            orderFeeData.takerFee
        );
        uint makerFee = MathUtil.abs(notionalDiff).mulDecimal(makerSize).mulDecimal(
            orderFeeData.makerFee
        );

        return baseFee + takerFee + makerFee;
    }

    // TODO: refactor possibly
    function _fillPrice(
        uin128 marketId,
        int skew,
        uint skewScale,
        int size,
        uint price
    ) internal view returns (uint) {
        int pdBefore = skew.divDecimal(skewScale);
        int pdAfter = skew.add(size).divDecimal(skewScale);
        int priceBefore = int(price).add(int(price).mulDecimal(pdBefore));
        int priceAfter = int(price).add(int(price).mulDecimal(pdAfter));

        // How is the p/d-adjusted price calculated using an example:
        //
        // price      = $1200 USD (oracle)
        // size       = 100
        // skew       = 0
        // skew_scale = 1,000,000 (1M)
        //
        // Then,
        //
        // pd_before = 0 / 1,000,000
        //           = 0
        // pd_after  = (0 + 100) / 1,000,000
        //           = 100 / 1,000,000
        //           = 0.0001
        //
        // price_before = 1200 * (1 + pd_before)
        //              = 1200 * (1 + 0)
        //              = 1200
        // price_after  = 1200 * (1 + pd_after)
        //              = 1200 * (1 + 0.0001)
        //              = 1200 * (1.0001)
        //              = 1200.12
        // Finally,
        //
        // fill_price = (price_before + price_after) / 2
        //            = (1200 + 1200.12) / 2
        //            = 1200.06
        return uint(priceBefore.add(priceAfter).divDecimal(_UNIT * 2));
    }

    function _sameSide(int a, int b) internal pure returns (bool) {
        return (a == 0) || (b == 0) || (a > 0) == (b > 0);
    }
}
