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

/**
 * @title Async order top level data storage
 */
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

    /**
     * @notice Thrown when attempting to settle an expired order.
     */
    error SettlementWindowExpired(
        uint256 timestamp,
        uint256 settlementTime,
        uint256 settlementExpiration
    );

    /**
     * @notice Thrown when attempting to cancel an order that is not yet expired.
     */
    error SettlementWindowNotExpired(
        uint256 timestamp,
        uint256 settlementTime,
        uint256 settlementExpiration
    );

    /**
     * @notice Thrown when order does not exist.
     * @dev Order does not exist if the order sizeDelta is 0.
     */
    error OrderNotValid();

    /**
     * @notice Thrown when fill price exceeds the acceptable price set at submission.
     */
    error AcceptablePriceExceeded(uint256 acceptablePrice, uint256 fillPrice);

    /**
     * @notice Gets thrown when commit order is called when a pending order already exists.
     */
    error OrderAlreadyCommitted(uint128 marketId, uint128 accountId);

    /**
     * @notice Gets thrown when pending orders exist and attempts to modify collateral.
     */
    error PendingOrderExist();

    /**
     * @notice Thrown when commiting an order with sizeDelta is zero.
     * @dev Size delta 0 is used to flag a non-valid order since it's a non-update order.
     */
    error ZeroSizeOrder();

    /**
     * @notice Thrown when there's not enough margin to cover the order and settlement costs associated.
     */
    error InsufficientMargin(int availableMargin, uint minMargin);

    struct Data {
        /**
         * @dev Order account id.
         */
        uint128 accountId;
        /**
         * @dev Order market id.
         */
        uint128 marketId;
        /**
         * @dev Order size delta (of asset units expresed in decimal 18 digits). It can be positive or negative.
         */
        int128 sizeDelta;
        /**
         * @dev Settlement strategy used for the order.
         */
        uint128 settlementStrategyId;
        /**
         * @dev Time at which the Settlement time is open.
         */
        uint256 settlementTime;
        /**
         * @dev Acceptable price set at submission. Longs will not be filled above this price, and shorts will not be filled below it.
         */
        uint256 acceptablePrice;
        /**
         * @dev An optional code provided by frontends to assist with tracking the source of volume and fees.
         */
        bytes32 trackingCode;
    }

    struct OrderCommitmentRequest {
        /**
         * @dev Order market id.
         */
        uint128 marketId;
        /**
         * @dev Order account id.
         */
        uint128 accountId;
        /**
         * @dev Order size delta (of asset units expressed in decimal 18 digits). It can be positive or negative.
         */
        int128 sizeDelta;
        /**
         * @dev Settlement strategy used for the order.
         */
        uint128 settlementStrategyId;
        /**
         * @dev Acceptable price set at submission.
         */
        uint256 acceptablePrice;
        /**
         * @dev Tracking code (optional).
         */
        bytes32 trackingCode;
    }

    /**
     * @notice Updates the order with the commitment request data and settlement time.
     */
    function load(uint128 accountId) internal pure returns (Data storage order) {
        bytes32 s = keccak256(abi.encode("io.synthetix.perps-market.AsyncOrder", accountId));

        assembly {
            order.slot := s
        }
    }

    /**
     * @dev Reverts if the order does not belongs to the market or not exists. Otherwise, returns the order.
     * @dev non-existent order is considered an order with sizeDelta == 0.
     */
    function loadValid(
        uint128 accountId,
        uint128 marketId
    ) internal view returns (Data storage order) {
        order = load(accountId);
        if (order.marketId != marketId || order.sizeDelta == 0) {
            revert OrderNotValid();
        }
    }

    /**
     * @dev Reverts if the order does not belongs to the market or not exists. Otherwise, returns the order.
     * @dev non-existent order is considered an order with sizeDelta == 0.
     */
    function createValid(
        uint128 accountId,
        uint128 marketId
    ) internal view returns (Data storage order) {
        order = load(accountId);
        if (order.sizeDelta != 0 && order.marketId == marketId) {
            revert OrderAlreadyCommitted(marketId, accountId);
        }

        if (order.sizeDelta != 0) {
            revert PendingOrderExist();
        }
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

    /**
     * @notice Resets the order.
     * @dev This function is called after the order is settled or cancelled.
     * @dev Just setting the sizeDelta to 0 is enough, since is the value checked to identify an active order at settlement time.
     * @dev The rest of the fields will be updated on the next commitmnet. Not doing it here is more gas efficient.
     */
    function reset(Data storage self) internal {
        self.sizeDelta = 0;
    }

    /**
     * @notice Checks if the order window settlement is opened and expired.
     * @dev Reverts if block.timestamp is < settlementTime (not <=, so even if the settlementDelay is set to zero, it will require at least 1 second waiting time)
     * @dev Reverts if block.timestamp is > settlementTime + settlementWindowDuration
     */
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

    /**
     * @notice Checks if the order can be cancelled.
     * @dev Reverts if block.timestamp is < settlementTime + settlementWindowDuration
     * @dev it means it didn't expire yet.
     */
    function checkCancellationEligibility(
        Data storage self,
        SettlementStrategy.Data storage settlementStrategy
    ) internal view {
        uint settlementExpiration = self.settlementTime +
            settlementStrategy.settlementWindowDuration;
        if (block.timestamp < settlementExpiration) {
            revert SettlementWindowNotExpired(
                block.timestamp,
                self.settlementTime,
                settlementExpiration
            );
        }
    }

    /**
     * @notice Checks if the storage order is valid (exists), and reverts otherwise
     */
    function checkValidity(Data storage self) internal view {
        if (self.sizeDelta == 0) {
            revert OrderNotValid();
        }
    }

    /**
     * @dev Struct used internally in validateOrder() to prevent stack too deep error.
     */
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
        bytes32 trackingCode;
    }

    /**
     * @notice Checks if the order can be settled.
     * @dev it recomputes market funding rate, calculates fill price and fees for the order
     * @dev and with that data it checks that:
     * @dev - the account is eligible for liquidation
     * @dev - the fill price is within the acceptable price range
     * @dev - the position size don't exced market configured limits
     * @dev - the account has enough margin to cover for the fees
     * @dev - the account has enough margin to not be liquidable immediately after the order is settled
     * @dev if the order can be executed, it returns (newPosition, orderFees, fillPrice, oldPosition)
     */
    function validateOrder(
        Data storage order,
        SettlementStrategy.Data storage strategy,
        uint256 orderPrice
    ) internal returns (Position.Data memory, uint, uint, Position.Data storage oldPosition) {
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

        oldPosition = PerpsMarket.load(order.marketId).positions[order.accountId];

        PerpsMarket.validatePositionSize(
            perpsMarketData,
            marketConfig.maxMarketSize,
            oldPosition.size,
            order.sizeDelta
        );

        runtime.newPositionSize = oldPosition.size + order.sizeDelta;
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

    /**
     * @notice Calculates the order fees.
     */
    function calculateOrderFee(
        int128 sizeDelta,
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

        // The proportions are computed as follows:
        // makerSize = abs(marketSkew) => since we are reversing the skew, the maker size is the current skew
        // takerSize = abs(marketSkew + sizeDelta) => since we are reversing the skew, the taker size is the new skew
        //
        // we then multiply the sizes by the fill price to get the notional value of each side, and that times the fee rate for each side

        uint makerFee = MathUtil.abs(marketSkew).mulDecimal(fillPrice).mulDecimal(
            orderFeeData.makerFee
        );

        uint takerFee = MathUtil.abs(marketSkew + sizeDelta).mulDecimal(fillPrice).mulDecimal(
            orderFeeData.takerFee
        );

        return takerFee + makerFee;
    }

    /**
     * @notice Calculates the fill price for an order.
     */
    function calculateFillPrice(
        int skew,
        uint skewScale,
        int size,
        uint price
    ) internal pure returns (uint) {
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
        if (skewScale == 0) {
            return price;
        }
        // calculate pd (premium/discount) before and after trade
        int pdBefore = skew.divDecimal(skewScale.toInt());
        int newSkew = skew + size;
        int pdAfter = newSkew.divDecimal(skewScale.toInt());

        // calculate price before and after trade with pd applied
        int priceBefore = price.toInt() + (price.toInt().mulDecimal(pdBefore));
        int priceAfter = price.toInt() + (price.toInt().mulDecimal(pdAfter));

        // the fill price is the average of those prices
        return (priceBefore + priceAfter).toUint().divDecimal(DecimalMath.UNIT * 2);
    }
}
