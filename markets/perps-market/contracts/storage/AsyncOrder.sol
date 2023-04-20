//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IAsyncOrderModule} from "../interfaces/IAsyncOrderModule.sol";
import {SettlementStrategy} from "./SettlementStrategy.sol";
import {Position} from "./Position.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";
import {LiquidationConfiguration} from "./LiquidationConfiguration.sol";
import {SettlementStrategy} from "./SettlementStrategy.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {PerpsAccount} from "./PerpsAccount.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {OrderFee} from "./OrderFee.sol";

library AsyncOrder {
    using DecimalMath for int256;
    using DecimalMath for int128;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using LiquidationConfiguration for LiquidationConfiguration.Data;
    using PerpsMarket for PerpsMarket.Data;
    using PerpsAccount for PerpsAccount.Data;
    using Position for Position.Data;

    error SettlementWindowExpired(
        uint256 timestamp,
        uint256 settlementTime,
        uint256 settlementExpiration
    );

    error OrderNotValid();

    struct Data {
        uint128 accountId;
        uint128 marketId;
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

    struct OrderCommitmentRequest {
        uint128 marketId;
        uint128 accountId;
        int256 sizeDelta; // TODO: change to int128
        uint256 settlementStrategyId;
        uint256 acceptablePrice;
        bytes32 trackingCode;
    }

    function update(
        Data storage self,
        OrderCommitmentRequest memory commitment,
        uint256 settlementTime
    ) internal {
        self.sizeDelta = commitment.sizeDelta;
        self.settlementStrategyId = commitment.settlementStrategyId;
        self.settlementTime = settlementTime;
        self.acceptablePrice = commitment.acceptablePrice;
        self.trackingCode = commitment.trackingCode;
        self.marketId = commitment.marketId;
        self.accountId = commitment.accountId;
    }

    function checkWithinSettlementWindow(
        Data storage self,
        SettlementStrategy.Data storage settlementStrategy
    ) internal view {
        uint settlementExpiration = self.settlementTime +
            settlementStrategy.settlementWindowDuration;
        if (block.timestamp < self.settlementTime || block.timestamp > settlementExpiration) {
            revert SettlementWindowExpired(
                block.timestamp,
                self.settlementTime,
                settlementExpiration
            );
        }
    }

    function checkValidity(Data storage self) internal view {
        if (self.sizeDelta == 0) {
            revert OrderNotValid();
        }
    }

    error ZeroSizeOrder();
    error InsufficientMargin(uint availableMargin, uint minMargin);

    struct SimulateDataRuntime {
        uint fillPrice;
        uint fees;
        uint availableMargin;
        uint currentLiquidationMargin;
        int128 newPositionSize;
        uint newLiquidationMargin;
        Position.Data newPosition;
    }

    function validateOrder(
        Data storage order,
        SettlementStrategy.Data storage strategy,
        uint256 orderPrice
    ) internal view returns (Position.Data memory, uint, uint) {
        if (order.sizeDelta == 0) {
            revert ZeroSizeOrder();
        }

        SimulateDataRuntime memory runtime;

        PerpsMarket.Data storage perpsMarketData = PerpsMarket.load(order.marketId);
        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
            order.marketId
        );
        PerpsAccount.Data storage account = PerpsAccount.load(order.accountId);

        // 1. calculate fees
        runtime.fillPrice = calculateFillPrice(
            perpsMarketData.skew,
            marketConfig.skewScale,
            order.sizeDelta,
            orderPrice
        );

        runtime.fees =
            calculateOrderFee(
                order.sizeDelta,
                runtime.fillPrice,
                perpsMarketData.skew,
                marketConfig.orderFees[PerpsMarketConfiguration.OrderType.ASYNC_OFFCHAIN]
            ) +
            strategy.settlementReward;

        // 2. check for margin requirements
        runtime.availableMargin = account.getAvailableMargin(order.accountId);
        if (runtime.availableMargin < runtime.fees) {
            revert InsufficientMargin(runtime.availableMargin, runtime.fees);
        }

        runtime.availableMargin -= runtime.fees;
        // load current position
        Position.Data storage position = PerpsMarket.load(order.marketId).positions[
            order.accountId
        ];

        runtime.currentLiquidationMargin = account.getAccountLiquidationAmount(
            order.accountId,
            order.marketId,
            MathUtil.abs(position.size.to256().mulDecimal(runtime.fillPrice.toInt()))
        );
        if (runtime.availableMargin < runtime.currentLiquidationMargin) {
            revert InsufficientMargin(runtime.availableMargin, runtime.currentLiquidationMargin);
        }

        // TODO: check for min initial margin

        runtime.newPositionSize = position.size + order.sizeDelta.to128();

        runtime.newLiquidationMargin = account.getAccountLiquidationAmount(
            order.accountId,
            order.marketId,
            MathUtil.abs(runtime.newPositionSize.to256().mulDecimal(runtime.fillPrice.toInt()))
        );

        // TODO: create new errors for different scenarios instead of reusing InsufficientMargin
        if (runtime.availableMargin < runtime.newLiquidationMargin) {
            revert InsufficientMargin(runtime.availableMargin, runtime.newLiquidationMargin);
        }

        runtime.newPosition = Position.Data({
            marketId: order.marketId,
            latestInteractionPrice: runtime.fillPrice.to128(),
            latestInteractionFunding: perpsMarketData.lastFundingValue.to128(),
            size: runtime.newPositionSize
        });

        return (runtime.newPosition, runtime.fees, runtime.fillPrice);
    }

    // function simulateOrderSettlement(
    //     Data storage order,
    //     Position.Data storage oldPosition,
    //     SettlementStrategy.Data storage settlementStrategy,
    //     uint256 orderPrice,
    //     PerpsMarketConfiguration.OrderType orderType
    // ) internal view returns (Position.Data memory, uint, uint, Status) {
    //     SimulateDataRuntime memory runtime;
    //     // Reverts if the user is trying to submit a size-zero order.
    //     if (order.sizeDelta == 0) {
    //         return (oldPosition, 0, 0, Status.ZeroSizeOrder);
    //     }

    //     // The order is not submitted if the user's existing position needs to be liquidated.
    //     // if (_canLiquidate(oldPos, params.oraclePrice)) {
    //     //     return (oldPos, 0 0,, 0, Status.CanLiquidate);
    //     // }

    //     PerpsMarket.Data storage perpsMarketData = PerpsMarket.load(order.marketId);
    //     // usd value of the difference in position (using the p/d-adjusted price).
    //     runtime.marketSkew = perpsMarketData.skew;
    //     PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(order.marketId);

    //     // calculate fill price
    //     runtime.fillPrice = calculateFillPrice(
    //         perpsMarketData.skew,
    //         marketConfig.skewScale,
    //         order.sizeDelta,
    //         orderPrice
    //     );

    //     // calculate the total fee for exchange
    //     runtime.fees = orderFee(
    //         order,
    //         runtime.fillPrice,
    //         runtime.marketSkew,
    //         marketConfig.orderFees[orderType]
    //     );

    //     runtime.settlementReward = settlementStrategy.settlementReward;

    //     runtime.totalFees = runtime.fees + runtime.settlementReward;

    //     LiquidationConfiguration.Data storage liquidationConfig = LiquidationConfiguration.load(
    //         order.marketId
    //     );

    //     // Deduct the fee.
    //     // It is an error if the realised margin minus the fee is negative or subject to liquidation.
    //     (runtime.newMargin, runtime.status) = recomputeMarginWithDelta(
    //         liquidationConfig,
    //         oldPosition,
    //         order.marketId,
    //         runtime.fillPrice,
    //         -(runtime.totalFees).toInt()
    //     );

    //     if (runtime.status != Status.Success) {
    //         return (oldPosition, 0, 0, runtime.status);
    //     }

    //     // construct new position
    //     runtime.newPos = Position.Data({
    //         marketId: order.marketId,
    //         latestInteractionPrice: runtime.fillPrice.to128(),
    //         latestInteractionFunding: perpsMarketData.lastFundingValue.to128(),
    //         size: (oldPosition.size + order.sizeDelta).to128()
    //     });

    //     // always allow to decrease a position, otherwise a margin of minInitialMargin can never
    //     // decrease a position as the price goes against them.
    //     // we also add the paid out fee for the minInitialMargin because otherwise minInitialMargin
    //     // is never the actual minMargin, because the first trade will always deduct
    //     // a fee (so the margin that otherwise would need to be transferred would have to include the future
    //     // fee as well, making the UX and definition of min-margin confusing).
    //     bool positionDecreasing = MathUtil.sameSide(oldPosition.size, runtime.newPos.size) &&
    //         MathUtil.abs(runtime.newPos.size) < MathUtil.abs(oldPosition.size);
    //     if (!positionDecreasing) {
    //         // minMargin + fee <= margin is equivalent to minMargin <= margin - fee
    //         // except that we get a nicer error message if fee > margin, rather than arithmetic overflow.
    //         console.log(marketConfig.minInitialMargin);
    //         if (
    //             runtime.newPos.latestInteractionMargin + runtime.totalFees <
    //             marketConfig.minInitialMargin
    //         ) {
    //             return (oldPosition, 0, 0, Status.InsufficientMargin);
    //         }
    //     }

    //     // check that new position margin is above liquidation margin
    //     // (above, in _recomputeMarginWithDelta() we checked the old position, here we check the new one)
    //     //
    //     // Liquidation margin is considered without a fee (but including premium), because it wouldn't make sense to allow
    //     // a trade that will make the position liquidatable.
    //     //
    //     // note: we use `oraclePrice` here as `liquidationPremium` calcs premium based not current skew.
    //     runtime.liqPremium = marketConfig.liquidationPremium(runtime.newPos.size, orderPrice);
    //     runtime.liqMargin =
    //         liquidationConfig.liquidationMargin(runtime.newPos.size, orderPrice) +
    //         runtime.liqPremium;
    //     if (runtime.newMargin <= runtime.liqMargin) {
    //         return (runtime.newPos, 0, 0, Status.CanLiquidate);
    //     }

    //     // Check that the maximum leverage is not exceeded when considering new margin including the paid fee.
    //     // The paid fee is considered for the benefit of UX of allowed max leverage, otherwise, the actual
    //     // max leverage is always below the max leverage parameter since the fee paid for a trade reduces the margin.
    //     // We'll allow a little extra headroom for rounding errors.
    //     runtime.leverage = runtime
    //         .newPos
    //         .size
    //         .to256()
    //         .mulDecimal(runtime.fillPrice.toInt())
    //         .divDecimal((runtime.newMargin + runtime.totalFees).toInt());
    //     if (marketConfig.maxLeverage + (DecimalMath.UNIT / 100) < MathUtil.abs(runtime.leverage)) {
    //         return (oldPosition, 0, 0, Status.MaxLeverageExceeded);
    //     }

    //     // Check that the order isn't too large for the markets.
    //     if (
    //         perpsMarketData.orderSizeTooLarge(
    //             marketConfig.maxMarketValue,
    //             oldPosition.size,
    //             runtime.newPos.size
    //         )
    //     ) {
    //         return (oldPosition, 0, 0, Status.MaxMarketValueExceeded);
    //     }

    //     return (runtime.newPos, runtime.fees, runtime.settlementReward, Status.Success);
    // }

    function calculateOrderFee(
        int sizeDelta,
        uint256 fillPrice,
        int marketSkew,
        OrderFee.Data storage orderFeeData
    ) internal view returns (uint) {
        int notionalDiff = sizeDelta.mulDecimal(fillPrice.toInt());

        // does this trade keep the skew on one side?
        if (MathUtil.sameSide(marketSkew + sizeDelta, marketSkew)) {
            // use a flat maker/taker fee for the entire size depending on whether the skew is increased or reduced.
            //
            // if the order is submitted on the same side as the skew (increasing it) - the taker fee is charged.
            // otherwise if the order is opposite to the skew, the maker fee is charged.

            uint staticRate = MathUtil.sameSide(notionalDiff, marketSkew)
                ? orderFeeData.takerFee
                : orderFeeData.makerFee;
            return MathUtil.abs(notionalDiff.mulDecimal(staticRate.toInt()));
        }

        // this trade flips the skew.
        //
        // the proportion of size that moves in the direction after the flip should not be considered
        // as a maker (reducing skew) as it's now taking (increasing skew) in the opposite direction. hence,
        // a different fee is applied on the proportion increasing the skew.

        // proportion of size that's on the other direction
        uint takerSize = MathUtil.abs((marketSkew + sizeDelta).divDecimal(sizeDelta));
        uint makerSize = DecimalMath.UNIT - takerSize;
        uint takerFee = MathUtil.abs(notionalDiff).mulDecimal(takerSize).mulDecimal(
            orderFeeData.takerFee
        );
        uint makerFee = MathUtil.abs(notionalDiff).mulDecimal(makerSize).mulDecimal(
            orderFeeData.makerFee
        );

        return takerFee + makerFee;
    }

    // TODO: refactor possibly
    function calculateFillPrice(
        int skew,
        uint skewScale,
        int size,
        uint price
    ) internal pure returns (uint) {
        int pdBefore = skew.divDecimal(skewScale.toInt());
        int pdAfter = (skew + size).divDecimal(skewScale.toInt());
        int priceBefore = price.toInt() + (price.toInt().mulDecimal(pdBefore));
        int priceAfter = price.toInt() + (price.toInt().mulDecimal(pdAfter));

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
        return (priceBefore + priceAfter).toUint().divDecimal(DecimalMath.UNIT * 2);
    }

    // function recomputeMarginWithDelta(
    //     LiquidationConfiguration.Data storage liquidationConfig,
    //     Position.Data memory position,
    //     uint128 marketId,
    //     uint price,
    //     int marginDelta
    // ) internal view returns (uint margin, Status statusCode) {
    //     (int marginProfitFunding, , , , ) = position.getPositionData(marketId, price);
    //     int newMargin = marginProfitFunding + marginDelta;
    //     if (newMargin < 0) {
    //         return (0, Status.InsufficientMargin);
    //     }

    //     uint uMargin = newMargin.toUint();
    //     int positionSize = position.size;
    //     // minimum margin beyond which position can be liquidated
    //     uint lMargin = liquidationConfig.liquidationMargin(positionSize, price);
    //     if (positionSize != 0 && uMargin <= lMargin) {
    //         return (uMargin, Status.CanLiquidate);
    //     }

    //     return (uMargin, Status.Success);
    // }
}
