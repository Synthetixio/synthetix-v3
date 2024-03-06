//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "./PerpMarketConfiguration.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {PerpMarket} from "./PerpMarket.sol";
import {Position} from "./Position.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";

library Margin {
    using DecimalMath for uint256;
    using DecimalMath for int256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

    // --- Structs --- //

    struct CollateralType {
        // Underlying sell oracle used by this spot collateral bytes32(0) if sUSD.
        bytes32 oracleNodeId;
        // Maximum allowable deposited amount for this collateral type.
        uint128 maxAllowable;
        // Address of the associated reward distributor.
        address rewardDistributor;
        // Adding exists so we can differentiate maxAllowable from 0 and unset in the supported mapping below.
        bool exists;
    }

    struct MarginValues {
        // USD value of deposited collaterals (adjusted collateral price) -fees, -funding, -utilization, +PnL.
        uint256 discountedMarginUsd;
        // USD value of deposited collaterals (unadjusted collateral price) -fees, -funding, -utilization, +PnL.
        uint256 marginUsd;
        // USD value of deposited collaterals (adjusted collateral price)
        uint256 discountedCollateralUsd;
        // USD value of deposited collaterals  (unadjusted collateral price)
        uint256 collateralUsd;
    }

    // --- Storage --- //

    struct GlobalData {
        // {synthMarketId: CollateralType}.
        mapping(uint128 => CollateralType) supported;
        // Array of supported synth ids useable as collateral for margin (use supported mapping)
        uint128[] supportedSynthMarketIds;
    }

    struct Data {
        // {synthMarketId: collateralAmount} (amount of collateral deposited into this account).
        mapping(uint128 => uint256) collaterals;
        // Debt in USD for this account.
        uint128 debtUsd;
    }

    function load() internal pure returns (Margin.GlobalData storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.Margin"));
        assembly {
            d.slot := s
        }
    }

    function load(
        uint128 accountId,
        uint128 marketId
    ) internal pure returns (Margin.Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.Margin", accountId, marketId));
        assembly {
            d.slot := s
        }
    }

    // --- Mutations --- //

    /**
     * @dev Reevaluates the collateral and debt for `accountId` with `amountDeltaUsd`. When amount is negative,
     * portion of their collateral is deducted. If positive, an equivalent amount of sUSD is credited to the
     * account. Returns the collateral and debt delta's.
     */
    function updateAccountDebtAndCollateral(
        Margin.Data storage accountMargin,
        PerpMarket.Data storage market,
        int256 amountDeltaUsd
    ) internal {
        // Nothing to update, this is a no-op.
        if (amountDeltaUsd == 0) {
            return;
        }

        // This is invoked when an order is settled and a modification of an existing position needs to be
        // performed, or when and order is cancelled.
        // There are a few scenarios we are trying to capture:
        //
        // 1. Increasing size for a profitable position
        // 2. Increasing size for a unprofitable position
        // 3. Decreasing size for an profitable position (partial close)
        // 4. Decreasing size for an unprofitable position (partial close)
        // 5. Closing a profitable position (full close)
        // 6. Closing an unprofitable position (full close)
        //
        // The commonalities:
        // - There is an existing position
        // - All position modifications involve 'touching' a position which realizes the profit/loss
        // - All profitable positions are first paying back any debt and the rest is added as sUSD as collateral
        // - All accounting can be performed within the market (i.e. no need to move tokens around)

        // These two ints are passed to market.updateDebtAndCollateral so global debt and collateral tracking can be updated.
        int128 debtAmountDeltaUsd = 0;
        int128 sUsdCollateralDelta = 0;

        uint128 absAmountDeltaUsd = MathUtil.abs(amountDeltaUsd).to128();
        // >0 means to add sUSD to this account's margin (realized profit).
        if (amountDeltaUsd > 0) {
            if (absAmountDeltaUsd > accountMargin.debtUsd) {
                // Enough profit to cover outstanding debt, this means we can pay off the debt and  increase sUSD collateral with the rest
                debtAmountDeltaUsd = -accountMargin.debtUsd.toInt(); // Debt should be reduced when position in profit
                accountMargin.debtUsd = 0;
                uint128 profitAfterDebt = absAmountDeltaUsd - accountMargin.debtUsd;
                accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] += profitAfterDebt;
                sUsdCollateralDelta = profitAfterDebt.toInt();
            } else {
                // The trader has an outstanding debt larger than the profit, just reduce the debt with all the profits
                accountMargin.debtUsd -= absAmountDeltaUsd;
                debtAmountDeltaUsd = -amountDeltaUsd.to128();
            }
        } else {
            // <0 means a realized loss and we need to increase their debt or pay with sUSD collateral.
            uint256 availableUsdCollateral = accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID];
            int256 newDebt = availableUsdCollateral.toInt() + amountDeltaUsd;
            if (newDebt > 0) {
                // We have enough sUSD to cover the loss, just deduct from collateral.
                accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] -= absAmountDeltaUsd;
                sUsdCollateralDelta = -absAmountDeltaUsd.toInt();
                // No changes to debt needed.
            } else {
                // We don't have enough sUSD to cover the loss, deduct what we can from the sUSD collateral and increase debt with the rest.
                uint128 newDebtAbs = MathUtil.abs(newDebt).to128();
                accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] = 0;
                sUsdCollateralDelta = -availableUsdCollateral.to128().toInt();
                // Debt should increase as we're lost money.
                accountMargin.debtUsd += newDebtAbs;
                debtAmountDeltaUsd = newDebtAbs.toInt();
            }
        }
        market.updateDebtAndCollateral(debtAmountDeltaUsd, sUsdCollateralDelta);
    }

    // --- Views --- //

    /**
     * @dev Returns the "raw" margin in USD before fees, `sum(p.collaterals.map(c => c.amount * c.price))`.
     */
    function getCollateralUsd(
        uint128 accountId,
        uint128 marketId
    ) internal view returns (uint256 collateralUsd, uint256 discountedCollateralUsd) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        // Variable declaration outside of loop to be more gas efficient.
        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        uint128 synthMarketId;
        uint256 available;

        uint256 collateralPrice;
        uint256 discountedCollateralPrice;

        for (uint256 i = 0; i < length; ) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            available = accountMargin.collaterals[synthMarketId];

            // `getCollateralPrice()` is an expensive op, skip if we can.
            if (available > 0) {
                collateralPrice = getCollateralPrice(
                    globalMarginConfig,
                    synthMarketId,
                    globalConfig
                );
                discountedCollateralPrice = getDiscountedPriceFromCollateralPrice(
                    available,
                    collateralPrice,
                    synthMarketId,
                    globalConfig
                );
                collateralUsd += available.mulDecimal(collateralPrice);
                discountedCollateralUsd += available.mulDecimal(discountedCollateralPrice);
            }
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Returns the margin value in usd given the account, market, and market price.
     *
     * Margin is effectively the discounted value of the deposited collateral, accounting for the funding accrued,
     * fees paid and any unrealized profit/loss on the position.
     *
     * In short, `collateralUsd  + position.funding + position.pnl - position.feesPaid`.
     */
    function getMarginUsd(
        uint128 accountId,
        PerpMarket.Data storage market,
        uint256 marketPrice
    ) internal view returns (MarginValues memory marginValues) {
        (uint256 collateralUsd, uint256 discountedCollateralUsd) = getCollateralUsd(
            accountId,
            market.id
        );
        Position.Data storage position = market.positions[accountId];
        Margin.Data storage accountMargin = Margin.load(accountId, market.id);

        // Zero size means there are no running sums to adjust margin by.
        int256 marginAdjustements = position.size == 0
            ? -(accountMargin.debtUsd.toInt())
            : position.getPnl(marketPrice) +
                position.getAccruedFunding(market, marketPrice) -
                position.getAccruedUtilization(market, marketPrice).toInt() -
                position.accruedFeesUsd.toInt() -
                accountMargin.debtUsd.to256().toInt();

        marginValues.discountedMarginUsd = MathUtil
            .max(discountedCollateralUsd.toInt() + marginAdjustements, 0)
            .toUint();
        marginValues.marginUsd = MathUtil
            .max(collateralUsd.toInt() + marginAdjustements, 0)
            .toUint();
        marginValues.discountedCollateralUsd = discountedCollateralUsd;
        marginValues.collateralUsd = collateralUsd;
        return marginValues;
    }

    // --- Member (views) --- //

    /**
     * @dev Helper to call oraclerManager.process on a given `synthMarketId`. Note that this can result in errors
     * if the `synthMarketId` does not exist.
     */
    function getOracleCollateralPrice(
        Margin.GlobalData storage self,
        uint128 synthMarketId,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        return
            globalConfig
                .oracleManager
                .process(self.supported[synthMarketId].oracleNodeId)
                .price
                .toUint();
    }

    /**
     * @dev Returns the unadjusted raw oracle collateral price.
     */
    function getCollateralPrice(
        Margin.GlobalData storage self,
        uint128 synthMarketId,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        return
            synthMarketId == SYNTHETIX_USD_MARKET_ID
                ? DecimalMath.UNIT
                : getOracleCollateralPrice(self, synthMarketId, globalConfig);
    }

    function getDiscountedPriceFromCollateralPrice(
        uint256 amountAvailable,
        uint256 price,
        uint128 synthMarketId,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        if (synthMarketId == SYNTHETIX_USD_MARKET_ID) {
            return DecimalMath.UNIT;
        }

        // Calculate discount on collateral if this collateral were to be instantly sold on spot.
        uint256 skewScale = globalConfig.spotMarket.getMarketSkewScale(synthMarketId);

        // skewScale _may_ be zero. In this event, do _not_ apply a discount.
        uint256 discount = skewScale == 0
            ? 0
            : MathUtil.min(
                MathUtil.max(
                    amountAvailable.mulDecimal(globalConfig.collateralDiscountScalar).divDecimal(
                        skewScale
                    ),
                    globalConfig.minCollateralDiscount
                ),
                globalConfig.maxCollateralDiscount
            );

        // Apply discount on price by the discount.
        return price.mulDecimal(DecimalMath.UNIT - discount);
    }
}
