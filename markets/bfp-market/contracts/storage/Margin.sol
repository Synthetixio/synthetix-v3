//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {PerpMarketConfiguration} from "./PerpMarketConfiguration.sol";
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
        /// Underlying sell oracle used by this spot collateral bytes32(0) if sUSD.
        bytes32 oracleNodeId;
        /// Maximum allowable deposited amount for this collateral type.
        uint128 maxAllowable;
        /// skewScale to use when caluclating collateral discount.
        uint128 skewScale;
        /// Address of the associated reward distributor.
        address rewardDistributor;
        /// Adding exists so we can differentiate maxAllowable from 0 and unset in the supported mapping below.
        bool exists;
    }

    struct MarginValues {
        /// USD value of deposited collaterals (adjusted collateral price) -fees, -funding, -utilization, +PnL.
        uint256 discountedMarginUsd;
        /// USD value of deposited collaterals (unadjusted collateral price) -fees, -funding, -utilization, +PnL.
        uint256 marginUsd;
        /// USD value of deposited collaterals (adjusted collateral price)
        uint256 discountedCollateralUsd;
        /// USD value of deposited collaterals  (unadjusted collateral price)
        uint256 collateralUsd;
    }

    // --- Storage --- //

    struct GlobalData {
        /// {collateralAddress: CollateralType}.
        mapping(address => CollateralType) supported;
        /// Array of useable as collateral for margin (use supported mapping)
        address[] supportedCollaterals;
    }

    struct Data {
        /// {collateralAddress: collateralAmount} (amount of collateral deposited into this account).
        mapping(address => uint256) collaterals;
        /// Debt in USD for this account.
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
     * @dev Re-evaluates the debt and collateral for `accountMargin` with `amountDeltaUsd`. When amount is negative,
     * a portion of their sUSD collateral is deducted. If positive, an equivalent amount of sUSD is credited to the
     * account margin.
     *
     * NOTE: `amountDeltaUsd` _must_ consider margin and incorporate `debtUsd`. This also performs a global change
     * in debt and collateral for the supplied `market`.
     */
    function realizeAccountPnlAndUpdate(
        Margin.Data storage accountMargin,
        PerpMarket.Data storage market,
        int256 amountDeltaUsd,
        address sUsdAddress
    ) internal {
        // Nothing to update, this is a no-op.
        if (amountDeltaUsd == 0) {
            return;
        }

        uint256 availableUsdCollateral = accountMargin.collaterals[sUsdAddress];
        uint128 previousDebt = accountMargin.debtUsd;

        if (amountDeltaUsd >= 0) {
            // >0 means profitable position, including the outstanding debt.
            accountMargin.debtUsd = 0;
            accountMargin.collaterals[sUsdAddress] += MathUtil.abs(amountDeltaUsd).to128();
        } else {
            // <0 means losing position (trade might have been profitable, but previous debt was larger).
            int256 usdCollateralAfterDebtPayment = availableUsdCollateral.toInt() + amountDeltaUsd;
            if (usdCollateralAfterDebtPayment >= 0) {
                accountMargin.collaterals[sUsdAddress] = usdCollateralAfterDebtPayment.toUint();
                accountMargin.debtUsd = 0;
            } else {
                if (availableUsdCollateral > 0) {
                    accountMargin.collaterals[sUsdAddress] = 0;
                }
                // Wipe `debtUsd` because we assume the passed `amountDeltaUsd` already attributes debtUsd before
                // passing the delta as `amountDeltaUsd`.
                accountMargin.debtUsd = MathUtil.abs(usdCollateralAfterDebtPayment).to128();
            }
        }

        int128 debtAmountDeltaUsd = accountMargin.debtUsd.toInt() - previousDebt.toInt();
        int128 usdCollateralDelta = accountMargin.collaterals[sUsdAddress].toInt().to128() -
            availableUsdCollateral.toInt().to128();
        market.updateDebtAndCollateral(debtAmountDeltaUsd, usdCollateralDelta, sUsdAddress);
    }

    // --- Views --- //

    /// @dev Returns the "raw" margin in USD before fees, `sum(p.collaterals.map(c => c.amount * c.price))`.
    function getCollateralUsd(
        uint128 accountId,
        uint128 marketId
    ) internal view returns (uint256 collateralUsd, uint256 discountedCollateralUsd) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        // Variable declaration outside of loop to be more gas efficient.
        uint256 length = globalMarginConfig.supportedCollaterals.length;
        address collateralAddress;
        uint256 available;

        uint256 collateralPrice;
        uint256 discountedCollateralPrice;

        for (uint256 i = 0; i < length; ) {
            collateralAddress = globalMarginConfig.supportedCollaterals[i];
            available = accountMargin.collaterals[collateralAddress];

            // `getCollateralPrice()` is an expensive op, skip if we can.
            if (available > 0) {
                collateralPrice = getCollateralPrice(
                    globalMarginConfig,
                    collateralAddress,
                    globalConfig
                );
                discountedCollateralPrice = getDiscountedCollateralPrice(
                    available,
                    collateralPrice,
                    collateralAddress,
                    globalConfig,
                    globalMarginConfig
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
     * @dev Returns the debt, price PnL, funding, util, and fee adjusted PnL.
     *
     * @notice Accepts two prices. First is a raw oracle price used to calculate funding and utilization. The second,
     * `pricePnLPrice`, is a price used to calculate the profit or losses incurred just on price PnL; passing `pricePnLPrice`
     * to `getPricePnl`. You may want to pass `fillPrice` as this argument if you want to calculate the true price PnL
     * immediately after settlement.
     */
    function getPnlAdjustmentUsd(
        uint128 accountId,
        PerpMarket.Data storage market,
        uint256 oraclePrice,
        uint256 pricePnLPrice
    ) internal view returns (int256) {
        Position.Data storage position = market.positions[accountId];
        Margin.Data storage accountMargin = Margin.load(accountId, market.id);

        // Zero size means there are no running sums to adjust margin by.
        return
            position.size == 0
                ? -(accountMargin.debtUsd.toInt())
                : position.getPricePnl(pricePnLPrice) +
                    position.getAccruedFunding(market, oraclePrice) -
                    position.getAccruedUtilization(market, oraclePrice).toInt() -
                    accountMargin.debtUsd.toInt();
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
        int256 adjustment = getPnlAdjustmentUsd(accountId, market, price, price);

        marginValues.discountedMarginUsd = MathUtil
            .max(discountedCollateralUsd.toInt() + adjustment, 0)
            .toUint();
        marginValues.marginUsd = MathUtil.max(collateralUsd.toInt() + adjustment, 0).toUint();
        marginValues.discountedCollateralUsd = discountedCollateralUsd;
        marginValues.collateralUsd = collateralUsd;
    }

    /// @dev Returns a boolean indicating whether the account has any collateral deposited.
    function hasCollateralDeposited(
        uint128 accountId,
        uint128 marketId
    ) internal view returns (bool) {
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        uint256 length = globalMarginConfig.supportedCollaterals.length;
        address collateralAddress;
        uint256 available;

        for (uint256 i = 0; i < length; ) {
            collateralAddress = globalMarginConfig.supportedCollaterals[i];
            available = accountMargin.collaterals[collateralAddress];

            if (available > 0) {
                return true;
            }
            unchecked {
                ++i;
            }
        }

        return false;
    }

    /**
     * @dev Returns the same collateralUsd as `getMarginUsd` without discount collateral.
     *
     * Why? It's expensive to fetch spotMarketSkewScale from another contract and although most times
     * you need both discounted and non-discounted values, sometimes you only need non-discounted.
     */
    function getCollateralUsdWithoutDiscount(
        uint128 accountId,
        uint128 marketId
    ) internal view returns (uint256) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        uint256 length = globalMarginConfig.supportedCollaterals.length;
        address collateralAddress;
        uint256 available;
        uint256 collateralPrice;
        uint256 collateralUsd;

        for (uint256 i = 0; i < length; ) {
            collateralAddress = globalMarginConfig.supportedCollaterals[i];
            available = accountMargin.collaterals[collateralAddress];

            if (available > 0) {
                collateralPrice = getCollateralPrice(
                    globalMarginConfig,
                    collateralAddress,
                    globalConfig
                );
                collateralUsd += available.mulDecimal(collateralPrice);
            }
            unchecked {
                ++i;
            }
        }
        return collateralUsd;
    }

    /// @dev Returns the NAV given the `accountId` and `market` where NAV is size * price + PnL.
    function getNetAssetValue(
        uint128 accountId,
        PerpMarket.Data storage market,
        uint256 price
    ) internal view returns (uint256) {
        return
            MathUtil
                .max(
                    getCollateralUsdWithoutDiscount(accountId, market.id).toInt() +
                        getPnlAdjustmentUsd(accountId, market, price, price),
                    0
                )
                .toUint();
    }

    // --- Member (views) --- //

    /// @dev Helper to call oracleManager.process for `collateralAddress`. Can revert if `collateralAddress` not found.
    function getOracleCollateralPrice(
        Margin.GlobalData storage self,
        address collateralAddress,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        return
            globalConfig
                .oracleManager
                .process(self.supported[collateralAddress].oracleNodeId)
                .price
                .toUint();
    }

    /// @dev Returns the unadjusted raw oracle collateral price.
    function getCollateralPrice(
        Margin.GlobalData storage self,
        address collateralAddress,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        return
            collateralAddress == address(globalConfig.usdToken)
                ? DecimalMath.UNIT
                : getOracleCollateralPrice(self, collateralAddress, globalConfig);
    }

    /**
     * @dev Returns the discounted price of a specified collateral.
     *
     * Discount is calculated based on the `spotMarket.skewScale` and is dependent on `amountAvailable`,
     * which may be different position to position. The larger `amountAvailable`, the larger the discount
     * however, capped between a min/max.
     */
    function getDiscountedCollateralPrice(
        uint256 amountAvailable,
        uint256 collateralPrice,
        address collateralAddress,
        PerpMarketConfiguration.GlobalData storage globalConfig,
        Margin.GlobalData storage globalMarginConfig
    ) internal view returns (uint256) {
        if (collateralAddress == address(globalConfig.usdToken)) {
            return DecimalMath.UNIT;
        }

        // Calculate discount on collateral if this collateral were to be instantly sold on spot.
        uint256 skewScale = globalMarginConfig.supported[collateralAddress].skewScale;

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

        // Apply discount on `collateralPrice` by the capped discount.
        return collateralPrice.mulDecimal(DecimalMath.UNIT - discount);
    }

    /// @dev Returns the reward for liquidating margin.
    function getMarginLiquidationOnlyReward(
        uint256 collateralValue,
        PerpMarketConfiguration.Data storage marketConfig,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        uint256 ethPrice = globalConfig
            .oracleManager
            .process(globalConfig.ethOracleNodeId)
            .price
            .toUint();
        uint256 liqExecutionCostInUsd = ethPrice.mulDecimal(
            block.basefee * globalConfig.keeperLiquidateMarginGasUnits
        );

        uint256 liqFeeInUsd = MathUtil.max(
            liqExecutionCostInUsd.mulDecimal(
                DecimalMath.UNIT + globalConfig.keeperProfitMarginPercent
            ),
            liqExecutionCostInUsd + globalConfig.keeperProfitMarginUsd
        );
        uint256 liqFeeWithRewardInUsd = liqFeeInUsd +
            collateralValue.mulDecimal(marketConfig.liquidationRewardPercent);

        return MathUtil.min(liqFeeWithRewardInUsd, globalConfig.maxKeeperFeeUsd);
    }

    /// @dev Returns whether an account in a specific market's margin can be liquidated.
    function isMarginLiquidatable(
        uint128 accountId,
        PerpMarket.Data storage market,
        Margin.MarginValues memory marginValues
    ) internal view returns (bool) {
        // Cannot liquidate margin when there is an open position.
        if (market.positions[accountId].size != 0) {
            return false;
        }

        return
            marginValues.discountedMarginUsd.toInt() -
                getMarginLiquidationOnlyReward(
                    marginValues.collateralUsd,
                    PerpMarketConfiguration.load(market.id),
                    PerpMarketConfiguration.load()
                ).toInt() <=
            0;
    }
}
