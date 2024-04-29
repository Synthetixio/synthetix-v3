//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SettlementStrategy} from "./SettlementStrategy.sol";
import {Position} from "./Position.sol";
import {PerpsMarketConfiguration} from "./PerpsMarketConfiguration.sol";
import {PerpsMarket} from "./PerpsMarket.sol";
import {PerpsPrice} from "./PerpsPrice.sol";
import {PerpsAccount} from "./PerpsAccount.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {OrderFee} from "./OrderFee.sol";
import {KeeperCosts} from "./KeeperCosts.sol";

/**
 * @title Async order top level data storage
 */
library AsyncOrder {
    using DecimalMath for int256;
    using DecimalMath for int128;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using PerpsMarket for PerpsMarket.Data;
    using PerpsAccount for PerpsAccount.Data;
    using KeeperCosts for KeeperCosts.Data;

    /**
     * @notice Thrown when settlement window is not open yet.
     */
    error SettlementWindowNotOpen(uint256 timestamp, uint256 settlementTime);

    /**
     * @notice Thrown when attempting to settle an expired order.
     */
    error SettlementWindowExpired(
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
    error AcceptablePriceExceeded(uint256 fillPrice, uint256 acceptablePrice);

    /**
     * @notice Gets thrown when attempting to cancel an order and price does not exceeds acceptable price.
     */
    error AcceptablePriceNotExceeded(uint256 fillPrice, uint256 acceptablePrice);

    /**
     * @notice Gets thrown when pending orders exist and attempts to modify collateral.
     */
    error PendingOrderExists();

    /**
     * @notice Thrown when commiting an order with sizeDelta is zero.
     * @dev Size delta 0 is used to flag a non-valid order since it's a non-update order.
     */
    error ZeroSizeOrder();

    /**
     * @notice Thrown when there's not enough margin to cover the order and settlement costs associated.
     */
    error InsufficientMargin(int256 availableMargin, uint256 minMargin);

    struct Data {
        /**
         * @dev Time at which the order was committed.
         */
        uint256 commitmentTime;
        /**
         * @dev Order request details.
         */
        OrderCommitmentRequest request;
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
         * @dev An optional code provided by frontends to assist with tracking the source of volume and fees.
         */
        bytes32 trackingCode;
        /**
         * @dev Referrer address to send the referrer fees to.
         */
        address referrer;
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
     * @dev Reverts if order was not committed by checking the sizeDelta.
     * @dev Reverts if order is not in the settlement window.
     */
    function loadValid(
        uint128 accountId
    ) internal view returns (Data storage order, SettlementStrategy.Data storage strategy) {
        order = load(accountId);
        if (order.request.sizeDelta == 0) {
            revert OrderNotValid();
        }

        strategy = PerpsMarketConfiguration.loadValidSettlementStrategy(
            order.request.marketId,
            order.request.settlementStrategyId
        );
        checkWithinSettlementWindow(order, strategy);
    }

    /**
     * @dev Updates the order with the new commitment request data and settlement time.
     * @dev Reverts if there's a pending order.
     * @dev Reverts if accont cannot open a new position (due to max allowed reached).
     */
    function updateValid(Data storage self, OrderCommitmentRequest memory newRequest) internal {
        checkPendingOrder(newRequest.accountId);

        PerpsAccount.validateMaxPositions(newRequest.accountId, newRequest.marketId);

        // Replace previous (or empty) order with the commitment request
        self.commitmentTime = block.timestamp;
        self.request = newRequest;
    }

    /**
     * @dev Reverts if there is a pending order.
     * @dev A pending order is one that has a sizeDelta and isn't expired yet.
     */
    function checkPendingOrder(uint128 accountId) internal view returns (Data storage order) {
        order = load(accountId);

        if (order.request.sizeDelta != 0) {
            SettlementStrategy.Data storage strategy = PerpsMarketConfiguration
                .load(order.request.marketId)
                .settlementStrategies[order.request.settlementStrategyId];

            if (!expired(order, strategy)) {
                revert PendingOrderExists();
            }
        }
    }

    /**
     * @notice Resets the order.
     * @dev This function is called after the order is settled.
     * @dev Just setting the sizeDelta to 0 is enough, since is the value checked to identify an active order at settlement time.
     * @dev The rest of the fields will be updated on the next commitment. Not doing it here is more gas efficient.
     */
    function reset(Data storage self) internal {
        self.request.sizeDelta = 0;
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
        uint256 settlementTime = self.commitmentTime + settlementStrategy.settlementDelay;
        uint256 settlementExpiration = settlementTime + settlementStrategy.settlementWindowDuration;

        if (block.timestamp < settlementTime) {
            revert SettlementWindowNotOpen(block.timestamp, settlementTime);
        }

        if (block.timestamp > settlementExpiration) {
            revert SettlementWindowExpired(block.timestamp, settlementTime, settlementExpiration);
        }
    }

    /**
     * @notice Returns if order is expired or not
     */
    function expired(
        Data storage self,
        SettlementStrategy.Data storage settlementStrategy
    ) internal view returns (bool) {
        uint256 settlementExpiration = self.commitmentTime +
            settlementStrategy.settlementDelay +
            settlementStrategy.settlementWindowDuration;
        return block.timestamp > settlementExpiration;
    }

    /**
     * @dev Struct used internally in validateOrder() to prevent stack too deep error.
     */
    struct SimulateDataRuntime {
        bool isEligible;
        int128 sizeDelta;
        uint128 accountId;
        uint128 marketId;
        uint256 fillPrice;
        uint256 orderFees;
        uint256 availableMargin;
        uint256 currentLiquidationMargin;
        uint256 accumulatedLiquidationRewards;
        uint256 currentLiquidationReward;
        int128 newPositionSize;
        uint256 newNotionalValue;
        int256 currentAvailableMargin;
        uint256 requiredInitialMargin;
        uint256 initialRequiredMargin;
        uint256 totalRequiredMargin;
        Position.Data newPosition;
        bytes32 trackingCode;
    }

    /**
     * @notice Checks if the order request can be settled.
     * @dev it recomputes market funding rate, calculates fill price and fees for the order
     * @dev and with that data it checks that:
     * @dev - the account is eligible for liquidation
     * @dev - the fill price is within the acceptable price range
     * @dev - the position size doesn't exceed market configured limits
     * @dev - the account has enough margin to cover for the fees
     * @dev - the account has enough margin to not be liquidable immediately after the order is settled
     * @dev if the order can be executed, it returns (newPosition, orderFees, fillPrice, oldPosition)
     */
    function validateRequest(
        Data storage order,
        SettlementStrategy.Data storage strategy,
        uint256 orderPrice
    ) internal returns (Position.Data memory, uint256, uint256, Position.Data storage oldPosition) {
        SimulateDataRuntime memory runtime;
        runtime.sizeDelta = order.request.sizeDelta;
        runtime.accountId = order.request.accountId;
        runtime.marketId = order.request.marketId;

        if (runtime.sizeDelta == 0) {
            revert ZeroSizeOrder();
        }

        PerpsAccount.Data storage account = PerpsAccount.load(runtime.accountId);

        (
            runtime.isEligible,
            runtime.currentAvailableMargin,
            runtime.requiredInitialMargin,
            ,
            runtime.currentLiquidationReward
        ) = account.isEligibleForLiquidation(PerpsPrice.Tolerance.DEFAULT);

        if (runtime.isEligible) {
            revert PerpsAccount.AccountLiquidatable(runtime.accountId);
        }

        PerpsMarket.Data storage perpsMarketData = PerpsMarket.load(runtime.marketId);
        perpsMarketData.recomputeFunding(orderPrice);

        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
            runtime.marketId
        );

        runtime.fillPrice = calculateFillPrice(
            perpsMarketData.skew,
            marketConfig.skewScale,
            runtime.sizeDelta,
            orderPrice
        );

        runtime.orderFees =
            calculateOrderFee(
                runtime.sizeDelta,
                runtime.fillPrice,
                perpsMarketData.skew,
                marketConfig.orderFees
            ) +
            settlementRewardCost(strategy);

        oldPosition = PerpsMarket.accountPosition(runtime.marketId, runtime.accountId);
        runtime.newPositionSize = oldPosition.size + runtime.sizeDelta;

        // only account for negative pnl
        runtime.currentAvailableMargin += MathUtil.min(
            calculateStartingPnl(runtime.fillPrice, orderPrice, runtime.newPositionSize),
            0
        );

        if (runtime.currentAvailableMargin < runtime.orderFees.toInt()) {
            revert InsufficientMargin(runtime.currentAvailableMargin, runtime.orderFees);
        }

        PerpsMarket.validatePositionSize(
            perpsMarketData,
            marketConfig.maxMarketSize,
            marketConfig.maxMarketValue,
            orderPrice,
            oldPosition.size,
            runtime.newPositionSize
        );

        runtime.totalRequiredMargin =
            getRequiredMarginWithNewPosition(
                account,
                marketConfig,
                runtime.marketId,
                oldPosition.size,
                runtime.newPositionSize,
                runtime.fillPrice,
                runtime.requiredInitialMargin
            ) +
            runtime.orderFees;

        if (runtime.currentAvailableMargin < runtime.totalRequiredMargin.toInt()) {
            revert InsufficientMargin(runtime.currentAvailableMargin, runtime.totalRequiredMargin);
        }

        runtime.newPosition = Position.Data({
            marketId: runtime.marketId,
            latestInteractionPrice: runtime.fillPrice.to128(),
            latestInteractionFunding: perpsMarketData.lastFundingValue.to128(),
            latestInterestAccrued: 0,
            size: runtime.newPositionSize
        });
        return (runtime.newPosition, runtime.orderFees, runtime.fillPrice, oldPosition);
    }

    /**
     * @notice Checks if the order request can be cancelled.
     * @notice This function doesn't check for liquidation or available margin since the fees to be paid are small and we did that check at commitment less than the settlement window time.
     * @notice it won't check if the order exists since it was already checked when loading the order (loadValid)
     * @dev it calculates fill price the order
     * @dev and with that data it checks that:
     * @dev - settlement window is open
     * @dev - the fill price is outside the acceptable price range
     * @dev if the order can be cancelled, it returns the fillPrice
     */
    function validateCancellation(
        Data storage order,
        SettlementStrategy.Data storage strategy,
        uint256 orderPrice
    ) internal view returns (uint256 fillPrice) {
        checkWithinSettlementWindow(order, strategy);

        PerpsMarket.Data storage perpsMarketData = PerpsMarket.load(order.request.marketId);

        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
            order.request.marketId
        );

        fillPrice = calculateFillPrice(
            perpsMarketData.skew,
            marketConfig.skewScale,
            order.request.sizeDelta,
            orderPrice
        );

        // check if fill price exceeded acceptable price
        if (!acceptablePriceExceeded(order, fillPrice)) {
            revert AcceptablePriceNotExceeded(fillPrice, order.request.acceptablePrice);
        }
    }

    /**
     * @notice Calculates the settlement rewards.
     */
    function settlementRewardCost(
        SettlementStrategy.Data storage strategy
    ) internal view returns (uint256) {
        return KeeperCosts.load().getSettlementKeeperCosts() + strategy.settlementReward;
    }

    /**
     * @notice Calculates the order fees.
     */
    function calculateOrderFee(
        int128 sizeDelta,
        uint256 fillPrice,
        int256 marketSkew,
        OrderFee.Data storage orderFeeData
    ) internal view returns (uint256) {
        int256 notionalDiff = sizeDelta.mulDecimal(fillPrice.toInt());

        // does this trade keep the skew on one side?
        if (MathUtil.sameSide(marketSkew + sizeDelta, marketSkew)) {
            // use a flat maker/taker fee for the entire size depending on whether the skew is increased or reduced.
            //
            // if the order is submitted on the same side as the skew (increasing it) - the taker fee is charged.
            // otherwise if the order is opposite to the skew, the maker fee is charged.

            uint256 staticRate = MathUtil.sameSide(notionalDiff, marketSkew)
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

        uint256 makerFee = MathUtil.abs(marketSkew).mulDecimal(fillPrice).mulDecimal(
            orderFeeData.makerFee
        );

        uint256 takerFee = MathUtil.abs(marketSkew + sizeDelta).mulDecimal(fillPrice).mulDecimal(
            orderFeeData.takerFee
        );

        return takerFee + makerFee;
    }

    /**
     * @notice Calculates the fill price for an order.
     */
    function calculateFillPrice(
        int256 skew,
        uint256 skewScale,
        int128 size,
        uint256 price
    ) internal pure returns (uint256) {
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
        int256 pdBefore = skew.divDecimal(skewScale.toInt());
        int256 newSkew = skew + size;
        int256 pdAfter = newSkew.divDecimal(skewScale.toInt());

        // calculate price before and after trade with pd applied
        int256 priceBefore = price.toInt() + (price.toInt().mulDecimal(pdBefore));
        int256 priceAfter = price.toInt() + (price.toInt().mulDecimal(pdAfter));

        // the fill price is the average of those prices
        return (priceBefore + priceAfter).toUint().divDecimal(DecimalMath.UNIT * 2);
    }

    struct RequiredMarginWithNewPositionRuntime {
        uint256 newRequiredMargin;
        uint256 oldRequiredMargin;
        uint256 requiredMarginForNewPosition;
        uint256 accumulatedLiquidationRewards;
        uint256 maxNumberOfWindows;
        uint256 numberOfWindows;
        uint256 requiredRewardMargin;
    }

    /**
     * @notice Initial pnl of a position after it's opened due to p/d fill price delta.
     */
    function calculateStartingPnl(
        uint256 fillPrice,
        uint256 marketPrice,
        int128 size
    ) internal pure returns (int256) {
        return size.mulDecimal(marketPrice.toInt() - fillPrice.toInt());
    }

    /**
     * @notice After the required margins are calculated with the old position, this function replaces the
     * old position initial margin with the new position initial margin requirements and returns them.
     * @dev SIP-359: If the position is being reduced, required margin is 0.
     */
    function getRequiredMarginWithNewPosition(
        PerpsAccount.Data storage account,
        PerpsMarketConfiguration.Data storage marketConfig,
        uint128 marketId,
        int128 oldPositionSize,
        int128 newPositionSize,
        uint256 fillPrice,
        uint256 currentTotalInitialMargin
    ) internal view returns (uint256) {
        RequiredMarginWithNewPositionRuntime memory runtime;

        if (MathUtil.isSameSideReducing(oldPositionSize, newPositionSize)) {
            return 0;
        }

        // get initial margin requirement for the new position
        (, , runtime.newRequiredMargin, ) = marketConfig.calculateRequiredMargins(
            newPositionSize,
            fillPrice
        );

        // get initial margin of old position
        (, , runtime.oldRequiredMargin, ) = marketConfig.calculateRequiredMargins(
            oldPositionSize,
            PerpsPrice.getCurrentPrice(marketId, PerpsPrice.Tolerance.DEFAULT)
        );

        // remove the old initial margin and add the new initial margin requirement
        // this gets us our total required margin for new position
        runtime.requiredMarginForNewPosition =
            currentTotalInitialMargin +
            runtime.newRequiredMargin -
            runtime.oldRequiredMargin;

        (runtime.accumulatedLiquidationRewards, runtime.maxNumberOfWindows) = account
            .getKeeperRewardsAndCosts(marketId);
        runtime.accumulatedLiquidationRewards += marketConfig.calculateFlagReward(
            MathUtil.abs(newPositionSize).mulDecimal(fillPrice)
        );
        runtime.numberOfWindows = marketConfig.numberOfLiquidationWindows(
            MathUtil.abs(newPositionSize)
        );
        runtime.maxNumberOfWindows = MathUtil.max(
            runtime.numberOfWindows,
            runtime.maxNumberOfWindows
        );

        runtime.requiredRewardMargin = account.getPossibleLiquidationReward(
            runtime.accumulatedLiquidationRewards,
            runtime.maxNumberOfWindows
        );

        // this is the required margin for the new position (minus any order fees)
        return runtime.requiredMarginForNewPosition + runtime.requiredRewardMargin;
    }

    function validateAcceptablePrice(Data storage order, uint256 fillPrice) internal view {
        if (acceptablePriceExceeded(order, fillPrice)) {
            revert AcceptablePriceExceeded(fillPrice, order.request.acceptablePrice);
        }
    }

    /**
     * @notice Checks if the fill price exceeds the acceptable price set at submission.
     */
    function acceptablePriceExceeded(
        Data storage order,
        uint256 fillPrice
    ) internal view returns (bool exceeded) {
        return
            (order.request.sizeDelta > 0 && fillPrice > order.request.acceptablePrice) ||
            (order.request.sizeDelta < 0 && fillPrice < order.request.acceptablePrice);
    }
}
