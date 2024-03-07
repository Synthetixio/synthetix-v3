//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "./PerpMarketConfiguration.sol";
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
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.GlobalMargin"));
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
     * account.
     *
     * NOTE: If `amountDeltaUsd` is margin then expected to include previous debt.
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

        uint256 availableUsdCollateral = accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID];
        uint128 previousDebt = accountMargin.debtUsd;

        if (amountDeltaUsd >= 0) {
            // >0 means profitable position, including the outstanding debt.
            accountMargin.debtUsd = 0;
            accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] += MathUtil
                .abs(amountDeltaUsd)
                .to128();
        } else {
            // <0 means losing position (trade might have been profitable, but previous debt was larger).
            int256 usdCollateralAfterDebtPayment = availableUsdCollateral.toInt() + amountDeltaUsd;
            if (usdCollateralAfterDebtPayment >= 0) {
                accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] = usdCollateralAfterDebtPayment
                    .toUint();
                accountMargin.debtUsd = 0;
            } else {
                accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] = 0;
                accountMargin.debtUsd = MathUtil.abs(usdCollateralAfterDebtPayment).to128();
            }
        }

        int128 debtAmountDeltaUsd = accountMargin.debtUsd.toInt() - previousDebt.toInt();
        int128 usdCollateralDelta = accountMargin
            .collaterals[SYNTHETIX_USD_MARKET_ID]
            .toInt()
            .to128() - availableUsdCollateral.toInt().to128();
        market.updateDebtAndCollateral(debtAmountDeltaUsd, usdCollateralDelta);
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
     * @dev Returns the debt, price pnl, funding, util, and fee adjusted PnL.
     */
    function getPnlAdjustmentUsd(
        uint128 accountId,
        PerpMarket.Data storage market,
        uint256 price
    ) internal view returns (int256) {
        Position.Data storage position = market.positions[accountId];
        Margin.Data storage accountMargin = Margin.load(accountId, market.id);

        // Zero size means there are no running sums to adjust margin by.
        return
            position.size == 0
                ? -(accountMargin.debtUsd.toInt())
                : position.getPricePnl(price) +
                    position.getAccruedFunding(market, price) -
                    position.getAccruedUtilization(market, price).toInt() -
                    position.accruedFeesUsd.toInt() -
                    accountMargin.debtUsd.to256().toInt();
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
        uint256 price
    ) internal view returns (MarginValues memory marginValues) {
        (uint256 collateralUsd, uint256 discountedCollateralUsd) = getCollateralUsd(
            accountId,
            market.id
        );
        int256 adjustment = getPnlAdjustmentUsd(accountId, market, price);

        marginValues.discountedMarginUsd = MathUtil
            .max(discountedCollateralUsd.toInt() + adjustment, 0)
            .toUint();
        marginValues.marginUsd = MathUtil.max(collateralUsd.toInt() + adjustment, 0).toUint();
        marginValues.discountedCollateralUsd = discountedCollateralUsd;
        marginValues.collateralUsd = collateralUsd;
    }

    /**
     * @dev Returns the NAV given the `accountId` and `market` where NAV is size * price + PnL.
     */
    function getNetAssetValue(
        uint128 accountId,
        PerpMarket.Data storage market,
        uint256 price
    ) internal view returns (uint256) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, market.id);

        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        uint128 synthMarketId;
        uint256 available;
        uint256 collateralPrice;
        uint256 collateralUsd;

        for (uint256 i = 0; i < length; ) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            available = accountMargin.collaterals[synthMarketId];

            if (available > 0) {
                collateralPrice = getCollateralPrice(
                    globalMarginConfig,
                    synthMarketId,
                    globalConfig
                );
                collateralUsd += available.mulDecimal(collateralPrice);
            }
            unchecked {
                ++i;
            }
        }
        return
            MathUtil
                .max(collateralUsd.toInt() + getPnlAdjustmentUsd(accountId, market, price), 0)
                .toUint();
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
