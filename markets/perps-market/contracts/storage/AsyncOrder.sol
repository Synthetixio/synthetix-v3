//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastI128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IAsyncOrderModule} from "../interfaces/IAsyncOrderModule.sol";
import {SettlementStrategy} from "./SettlementStrategy.sol";
import {Position} from "./Position.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";
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
    using PerpsMarket for PerpsMarket.Data;
    using PerpsAccount for PerpsAccount.Data;
    using Position for Position.Data;

    error SettlementWindowExpired(
        uint256 timestamp,
        uint256 settlementTime,
        uint256 settlementExpiration
    );

    error OrderNotValid();

    error AcceptablePriceExceeded(uint256 acceptablePrice, uint256 fillPrice);

    struct Data {
        uint128 accountId;
        uint128 marketId;
        int256 sizeDelta;
        uint256 settlementStrategyId;
        uint256 settlementTime;
        uint256 acceptablePrice;
        bytes32 trackingCode;
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

    function reset(Data storage self) internal {
        self.sizeDelta = 0;

        // setting the rest to 0 is not necessary, and is gas inefficient since it will be overwritten at new order claim.
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
    error InsufficientMargin(int availableMargin, uint minMargin);

    struct SimulateDataRuntime {
        uint fillPrice;
        uint orderFees;
        uint availableMargin;
        uint currentLiquidationMargin;
        int128 newPositionSize;
        uint newNotionalValue;
        int currentAvailableMargin;
        uint requiredMaintenanceMargin;
        uint initialRequiredMargin;
        uint totalRequiredMargin;
        Position.Data newPosition;
    }

    function validateOrder(
        Data storage order,
        SettlementStrategy.Data storage strategy,
        uint256 orderPrice
    )
        internal
        returns (
            // return pnl
            Position.Data memory,
            uint,
            uint,
            Position.Data storage oldPosition
        )
    {
        if (order.sizeDelta == 0) {
            revert ZeroSizeOrder();
        }
        SimulateDataRuntime memory runtime;

        PerpsAccount.Data storage account = PerpsAccount.load(order.accountId);

        bool isEligible;
        (isEligible, runtime.currentAvailableMargin, runtime.requiredMaintenanceMargin) = account
            .isEligibleForLiquidation();

        if (isEligible) {
            revert PerpsAccount.AccountLiquidatable(order.accountId);
        }

        PerpsMarket.Data storage perpsMarketData = PerpsMarket.load(order.marketId);
        perpsMarketData.recomputeFunding(orderPrice);

        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
            order.marketId
        );

        runtime.fillPrice = calculateFillPrice(
            perpsMarketData.skew,
            marketConfig.skewScale,
            order.sizeDelta,
            orderPrice
        );

        if (
            (order.sizeDelta > 0 && runtime.fillPrice > order.acceptablePrice) ||
            (order.sizeDelta < 0 && runtime.fillPrice < order.acceptablePrice)
        ) {
            revert AcceptablePriceExceeded(runtime.fillPrice, order.acceptablePrice);
        }

        runtime.orderFees =
            calculateOrderFee(
                order.sizeDelta,
                runtime.fillPrice,
                perpsMarketData.skew,
                marketConfig.orderFees
            ) +
            strategy.settlementReward;

        if (runtime.currentAvailableMargin < runtime.orderFees.toInt()) {
            revert InsufficientMargin(runtime.currentAvailableMargin, runtime.orderFees);
        }

        // TODO: validate position size
        oldPosition = PerpsMarket.load(order.marketId).positions[order.accountId];

        runtime.newPositionSize = oldPosition.size + order.sizeDelta.to128();
        (, , runtime.initialRequiredMargin, , ) = marketConfig.calculateRequiredMargins(
            runtime.newPositionSize,
            runtime.fillPrice
        );

        // use order price to determine notional value here since we need to subtract
        // this amount
        (, , , uint256 currentMarketMaintenanceMargin, ) = marketConfig.calculateRequiredMargins(
            oldPosition.size,
            orderPrice
        );

        // requiredMaintenanceMargin includes the maintenance margin for the current position that's
        // being modified, so we subtract the maintenance margin and use the initial required margin
        runtime.totalRequiredMargin =
            runtime.orderFees +
            runtime.requiredMaintenanceMargin +
            runtime.initialRequiredMargin -
            currentMarketMaintenanceMargin;
        // TODO: create new errors for different scenarios instead of reusing InsufficientMargin
        if (runtime.currentAvailableMargin < runtime.totalRequiredMargin.toInt()) {
            revert InsufficientMargin(runtime.currentAvailableMargin, runtime.totalRequiredMargin);
        }

        runtime.newPosition = Position.Data({
            marketId: order.marketId,
            latestInteractionPrice: runtime.fillPrice.to128(),
            latestInteractionFunding: perpsMarketData.lastFundingValue.to128(),
            size: runtime.newPositionSize
        });
        return (runtime.newPosition, runtime.orderFees, runtime.fillPrice, oldPosition);
    }

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
}
