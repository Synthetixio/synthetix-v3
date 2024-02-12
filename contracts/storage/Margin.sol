//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "./PerpMarketConfiguration.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
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
    }

    function load() internal pure returns (Margin.GlobalData storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.Margin"));
        assembly {
            d.slot := s
        }
    }

    function load(uint128 accountId, uint128 marketId) internal pure returns (Margin.Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.Margin", accountId, marketId));
        assembly {
            d.slot := s
        }
    }

    /**
     * @dev Withdraw `amount` synths from deposits to sell for sUSD and burn for LPs.
     */
    function sellNonSusdCollateral(
        uint128 marketId,
        uint128 synthMarketId,
        uint256 amount,
        uint256 price,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal {
        globalConfig.synthetix.withdrawMarketCollateral(
            marketId,
            globalConfig.spotMarket.getSynth(synthMarketId),
            amount
        );
        uint256 minAmountReceivedUsd = amount.mulDecimal(price).mulDecimal(
            DecimalMath.UNIT - globalConfig.sellExactInMaxSlippagePercent
        );
        (uint256 amountUsd, ) = globalConfig.spotMarket.sellExactIn(
            synthMarketId,
            amount,
            minAmountReceivedUsd,
            address(0)
        );
        globalConfig.synthetix.depositMarketUsd(marketId, address(this), amountUsd);
    }

    // --- Mutations --- //

    /**
     * @dev Reevaluates the collateral in `market` for `accountId` with `amountDeltaUsd`. When amount is negative,
     * portion of their collateral is deducted. If positive, an equivalent amount of sUSD is credited to the
     * account.
     */
    function updateAccountCollateral(
        uint128 accountId,
        PerpMarket.Data storage market,
        int256 amountDeltaUsd
    ) internal {
        // Nothing to update, this is a no-op.
        if (amountDeltaUsd == 0) {
            return;
        }

        // This is invoked when an order is settled and a modification of an existing position needs to be
        // performed. There are a few scenarios we are trying to capture:
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
        // - All profitable positions are given more sUSD as collateral
        // - All accounting can be performed within the market (i.e. no need to move tokens around)
        Margin.Data storage accountMargin = Margin.load(accountId, market.id);

        // >0 means to add sUSD to this account's margin (realized profit).
        if (amountDeltaUsd > 0) {
            accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] += amountDeltaUsd.toUint();
            market.depositedCollateral[SYNTHETIX_USD_MARKET_ID] += amountDeltaUsd.toUint();
        } else {
            // <0 means a realized loss and we need to partially deduct from their collateral.
            Margin.GlobalData storage globalMarginConfig = Margin.load();
            PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

            // Variable declaration outside of loop to be more gas efficient.
            uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
            uint256 amountToDeductUsd = MathUtil.abs(amountDeltaUsd);

            uint128 synthMarketId;
            uint256 available;
            uint256 collateralPrice;
            uint256 deductionAmount;
            uint256 deductionAmountUsd;

            for (uint256 i = 0; i < length; ) {
                synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
                available = accountMargin.collaterals[synthMarketId];

                // Account has _any_ amount to deduct collateral from (or has realized profits if sUSD).
                //
                // NOTE: The invocation to fetch market price relies on an upstream operation to update and store a Pyth
                // price. This is entirely due the atomic spot sale of non sUSD collateral. As such, any call to `updateAccountCollateral`
                // must be preceeded with a `parsePythPrice` invocation (assuming the account has zero sUSD or not enough sUSD to
                // cover costs to pay back negative pnl either via fees, losses, or both).
                if (available > 0) {
                    collateralPrice = getCollateralPrice(globalMarginConfig, synthMarketId, globalConfig);
                    deductionAmountUsd = MathUtil.min(amountToDeductUsd, available.mulDecimal(collateralPrice));
                    deductionAmount = deductionAmountUsd.divDecimal(collateralPrice);

                    // If collateral is _not_ sUSD, withdraw, sell, and deposit as USD then continue update accounting.
                    if (synthMarketId != SYNTHETIX_USD_MARKET_ID) {
                        sellNonSusdCollateral(market.id, synthMarketId, deductionAmount, collateralPrice, globalConfig);
                    }

                    // At this point we can just update the accounting.
                    //
                    // Non-sUSD collateral has been sold for sUSD and deposited to core system. The
                    // `amountDeltaUsd` will take order fees, keeper fees and funding into account.
                    //
                    // If sUSD is used we can just update the accounting directly.
                    accountMargin.collaterals[synthMarketId] -= deductionAmount;
                    market.depositedCollateral[synthMarketId] -= deductionAmount;
                    amountToDeductUsd -= deductionAmountUsd;
                }

                // Exit early in the event the first deducted collateral is enough to cover the loss.
                if (amountToDeductUsd == 0) {
                    break;
                }

                unchecked {
                    ++i;
                }
            }

            // Not enough remaining margin to deduct from `-amount`.
            //
            // NOTE: This is _only_ used within settlement and should revert settlement if the margin is
            // not enough to cover fees incurred to modify position. However, IM/MM should be configured
            // well enough to prevent this from ever happening. Additionally, instant liquidation checks
            // should also prevent this from happening too.
            if (amountToDeductUsd > 0) {
                revert ErrorUtil.InsufficientMargin();
            }
        }
    }

    // --- Views --- //

    /**
     * @dev Returns the "raw" margin in USD before fees, `sum(p.collaterals.map(c => c.amount * c.price))`.
     */
    function getCollateralUsd(
        uint128 accountId,
        uint128 marketId,
        bool useDiscountedCollateralPrice
    ) internal view returns (uint256) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        // Variable declaration outside of loop to be more gas efficient.
        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        uint128 synthMarketId;
        uint256 available;
        uint256 collateralUsd;
        uint256 collateralPrice;

        for (uint256 i = 0; i < length; ) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            available = accountMargin.collaterals[synthMarketId];

            // `getCollateralPrice()` is an expensive op, skip if we can.
            if (available > 0) {
                collateralPrice = useDiscountedCollateralPrice
                    ? getDiscountedCollateralPrice(globalMarginConfig, synthMarketId, available, globalConfig)
                    : getCollateralPrice(globalMarginConfig, synthMarketId, globalConfig);
                collateralUsd += available.mulDecimal(collateralPrice);
            }

            unchecked {
                ++i;
            }
        }

        return collateralUsd;
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
        uint256 marketPrice,
        bool useDiscountedCollateralPrice
    ) internal view returns (uint256) {
        uint256 collateralUsd = getCollateralUsd(accountId, market.id, useDiscountedCollateralPrice);
        Position.Data storage position = market.positions[accountId];

        // Zero position means that marginUsd eq collateralUsd.
        if (position.size == 0) {
            return collateralUsd;
        }
        return
            MathUtil
                .max(
                    collateralUsd.toInt() +
                        position.getPnl(marketPrice) +
                        position.getAccruedFunding(market, marketPrice) -
                        position.getAccruedUtilization(market, marketPrice).toInt() -
                        position.accruedFeesUsd.toInt(),
                    0
                )
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
        return globalConfig.oracleManager.process(self.supported[synthMarketId].oracleNodeId).price.toUint();
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

    /**
     * @dev Returns the discount adjusted collateral price proportional to `available`, scaled spot market skewScale.
     */
    function getDiscountedCollateralPrice(
        Margin.GlobalData storage self,
        uint128 synthMarketId,
        uint256 available,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        if (synthMarketId == SYNTHETIX_USD_MARKET_ID) {
            return DecimalMath.UNIT;
        }

        // Calculate discount on collateral if this collateral were to be instantly sold on spot.
        uint256 price = getOracleCollateralPrice(self, synthMarketId, globalConfig);
        uint256 skewScale = globalConfig.spotMarket.getMarketSkewScale(synthMarketId).mulDecimal(
            globalConfig.spotMarketSkewScaleScalar
        );

        // skewScale _may_ be zero. In this event, do _not_ apply a discount.
        uint256 discount = skewScale == 0
            ? 0
            : MathUtil.min(
                MathUtil.max(available.divDecimal(skewScale), globalConfig.minCollateralDiscount),
                globalConfig.maxCollateralDiscount
            );

        // Apply discount on price by the discount.
        return price.mulDecimal(DecimalMath.UNIT - discount);
    }
}
