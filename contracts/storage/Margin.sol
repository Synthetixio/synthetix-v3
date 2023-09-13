//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {PerpMarketConfiguration, SYNTHETIX_USD_MARKET_ID} from "./PerpMarketConfiguration.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {PerpMarket} from "./PerpMarket.sol";
import {Position} from "./Position.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";

library Margin {
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;

    // --- Constants --- //

    bytes32 private constant SLOT_NAME = keccak256(abi.encode("io.synthetix.bfp-market.Margin"));

    // --- Structs --- //

    struct CollateralType {
        // Maximum allowable deposited amount for this collateral type.
        uint128 maxAllowable;
    }

    // --- Storage --- //

    struct GlobalData {
        // {synthMarketId: CollateralType}.
        mapping(uint128 => CollateralType) supported;
        // Array of supported synth spot market ids useable as collateral for margin.
        uint128[] supportedSynthMarketIds;
    }

    struct Data {
        // {synthMarketId: collateralAmount} (amount of collateral deposited into this account).
        mapping(uint128 => uint256) collaterals;
    }

    function load(uint128 accountId, uint128 marketId) internal pure returns (Margin.Data storage d) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.Margin", accountId, marketId));

        assembly {
            d.slot := s
        }
    }

    function load() internal pure returns (Margin.GlobalData storage d) {
        bytes32 s = SLOT_NAME;

        assembly {
            d.slot := s
        }
    }

    // --- Mutative --- //

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

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.Data storage accountMargin = Margin.load(accountId, market.id);

        // >0 means to add sUSD to this account's margin (realized profit).
        if (amountDeltaUsd > 0) {
            accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] += amountDeltaUsd.toUint();
        } else {
            // <0 means a realized loss and we need to partially deduct from their collateral.
            Margin.GlobalData storage globalMarginConfig = Margin.load();
            uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
            uint256 amountToDeductUsd = MathUtil.abs(amountDeltaUsd);

            // Variable declaration outside of loop to be more gas efficient.
            uint128 synthMarketId;
            uint256 available;
            uint256 price;
            uint256 deductionAmount;
            uint256 deductionAmountUsd;

            for (uint256 i = 0; i < length; ) {
                synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
                available = accountMargin.collaterals[synthMarketId];

                // Account has _any_ amount to deduct collateral from (or has realized profits if sUSD).
                if (available > 0) {
                    price = getCollateralPrice(synthMarketId, available, globalConfig);
                    deductionAmountUsd = MathUtil.min(amountToDeductUsd, available.mulDecimal(price));
                    deductionAmount = deductionAmountUsd.divDecimal(price);
                    accountMargin.collaterals[synthMarketId] -= deductionAmount;
                    amountToDeductUsd -= deductionAmountUsd;
                }

                // Exit early in the event the first deducted collateral is enough to cover the loss.
                if (amountToDeductUsd == 0) {
                    break;
                }

                unchecked {
                    i++;
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

    /**
     * @dev Zeros out the deposited collateral for `accountId` in `marketId`. This is used in scenarios
     * where we can confidently remove the collateral credited to `accountId` e.g. at the end of a liquidation
     * event.
     */
    function clearAccountCollateral(uint128 accountId, uint128 marketId) internal {
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        uint128 synthMarketId;
        uint256 available;

        for (uint256 i = 0; i < length; ) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            available = accountMargin.collaterals[synthMarketId];

            // Avoid changing the value to zero if already zero.
            if (available > 0) {
                accountMargin.collaterals[synthMarketId] = 0;
            }

            unchecked {
                i++;
            }
        }
    }

    // --- Views --- //

    /**
     * @dev Returns the collateral price based on the quote price from the spot market. This is necessary to discount
     * the collateral value relative fees incurred on the sale during liquidation. Fees might be either the skew fee
     * incurred if skewed is expanded on spot and/or a flat fee on the market to spot market LPs.
     */
    function getCollateralPrice(
        uint128 synthMarketId,
        uint256 available,
        PerpMarketConfiguration.GlobalData storage globalConfig
    ) internal view returns (uint256) {
        (uint256 price, ) = globalConfig.spotMarket.quoteSellExactIn(synthMarketId, available);
        return price;
    }

    /**
     * @dev Returns the "raw" margin in USD before fees, `sum(p.collaterals.map(c => c.amount * c.price))`.
     */
    function getCollateralUsd(uint128 accountId, uint128 marketId) internal view returns (uint256) {
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        // Variable declaration outside of loop to be more gas efficient.
        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        uint128 synthMarketId;
        uint256 available;
        uint256 collateralUsd;

        for (uint256 i = 0; i < length; ) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            available = accountMargin.collaterals[synthMarketId];

            // `getCollateralPrice()` is an expensive op, skip if we can.
            if (available > 0) {
                collateralUsd += available.mulDecimal(getCollateralPrice(synthMarketId, available, globalConfig));
            }

            unchecked {
                i++;
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
     * In short, `collateralValueUsd  + position.funding + position.pnl - position.feesPaid`.
     */
    function getMarginUsd(
        uint128 accountId,
        PerpMarket.Data storage market,
        uint256 price
    ) internal view returns (uint256) {
        uint256 collateralUsd = getCollateralUsd(accountId, market.id);
        Position.Data storage position = market.positions[accountId];

        // Zero position means that marginUsd eq collateralUsd.
        if (position.size == 0) {
            return collateralUsd;
        }
        return
            MathUtil
                .max(
                    collateralUsd.toInt() +
                        position.getPnl(price) +
                        position.getAccruedFunding(market, price) -
                        position.accruedFeesUsd.toInt(),
                    0
                )
                .toUint();
    }
}
