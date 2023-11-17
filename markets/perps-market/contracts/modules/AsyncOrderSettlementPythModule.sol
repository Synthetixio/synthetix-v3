//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {IAsyncOrderSettlementPythModule} from "../interfaces/IAsyncOrderSettlementPythModule.sol";
import {PerpsAccount, SNX_USD_MARKET_ID} from "../storage/PerpsAccount.sol";
import {OffchainUtil} from "../utils/OffchainUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Flags} from "../utils/Flags.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {Position} from "../storage/Position.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";
import {IAccountEvents} from "../interfaces/IAccountEvents.sol";
import {KeeperCosts} from "../storage/KeeperCosts.sol";
import {IPythERC7412Wrapper} from "../interfaces/external/IPythERC7412Wrapper.sol";
import {SafeCastU256, SafeCastI256, SafeCastI64} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @title Module for settling async orders using pyth as price feed.
 * @dev See IAsyncOrderSettlementPythModule.
 */
contract AsyncOrderSettlementPythModule is
    IAsyncOrderSettlementPythModule,
    IMarketEvents,
    IAccountEvents
{
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastI64 for int64;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarket for PerpsMarket.Data;
    using AsyncOrder for AsyncOrder.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using Position for Position.Data;
    using KeeperCosts for KeeperCosts.Data;

    /**
     * @inheritdoc IAsyncOrderSettlementPythModule
     */
    function settleOrder(uint128 accountId) external {
        FeatureFlag.ensureAccessToFeature(Flags.PERPS_SYSTEM);

        (
            AsyncOrder.Data storage asyncOrder,
            SettlementStrategy.Data storage settlementStrategy
        ) = AsyncOrder.loadValid(accountId);

        int64 offchainPrice = IPythERC7412Wrapper(settlementStrategy.priceVerificationContract)
            .getBenchmarkPrice(settlementStrategy.feedId, asyncOrder.settlementTime.to64());

        _settleOrder(offchainPrice.toUint().to256().toUint(), asyncOrder, settlementStrategy);
    }

    /**
     * @dev used for settleing an order.
     */
    function _settleOrder(
        uint256 price,
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private {
        SettleOrderRuntime memory runtime;
        runtime.accountId = asyncOrder.request.accountId;
        runtime.marketId = asyncOrder.request.marketId;
        // check if account is flagged
        GlobalPerpsMarket.load().checkLiquidation(runtime.accountId);

        Position.Data storage oldPosition;
        (runtime.newPosition, runtime.totalFees, runtime.fillPrice, oldPosition) = asyncOrder
            .validateRequest(settlementStrategy, price);

        runtime.amountToDeduct = runtime.totalFees;
        runtime.newPositionSize = runtime.newPosition.size;
        runtime.sizeDelta = asyncOrder.request.sizeDelta;

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        PerpsAccount.Data storage perpsAccount = PerpsAccount.load(runtime.accountId);

        // use fill price to calculate realized pnl
        (runtime.pnl, , runtime.accruedFunding, , ) = oldPosition.getPnl(runtime.fillPrice);
        runtime.pnlUint = MathUtil.abs(runtime.pnl);

        if (runtime.pnl > 0) {
            perpsAccount.updateCollateralAmount(SNX_USD_MARKET_ID, runtime.pnl);
        } else if (runtime.pnl < 0) {
            runtime.amountToDeduct += runtime.pnlUint;
        }

        // after pnl is realized, update position
        runtime.updateData = PerpsMarket.loadValid(runtime.marketId).updatePositionData(
            runtime.accountId,
            runtime.newPosition
        );
        perpsAccount.updateOpenPositions(runtime.marketId, runtime.newPositionSize);

        emit MarketUpdated(
            runtime.updateData.marketId,
            price,
            runtime.updateData.skew,
            runtime.updateData.size,
            runtime.sizeDelta,
            runtime.updateData.currentFundingRate,
            runtime.updateData.currentFundingVelocity
        );

        // since margin is deposited, as long as the owed collateral is deducted
        // fees are realized by the stakers
        if (runtime.amountToDeduct > 0) {
            (uint128[] memory deductedSynthIds, uint256[] memory deductedAmount) = perpsAccount
                .deductFromAccount(runtime.amountToDeduct);
            for (uint256 i = 0; i < deductedSynthIds.length; i++) {
                if (deductedAmount[i] > 0) {
                    emit CollateralDeducted(
                        runtime.accountId,
                        deductedSynthIds[i],
                        deductedAmount[i]
                    );
                }
            }
        }
        runtime.settlementReward =
            settlementStrategy.settlementReward +
            KeeperCosts.load().getSettlementKeeperCosts(runtime.accountId);

        if (runtime.settlementReward > 0) {
            // pay keeper
            factory.withdrawMarketUsd(ERC2771Context._msgSender(), runtime.settlementReward);
        }

        (runtime.referralFees, runtime.feeCollectorFees) = GlobalPerpsMarketConfiguration
            .load()
            .collectFees(
                runtime.totalFees - runtime.settlementReward, // totalFees includes settlement reward so we remove it
                asyncOrder.request.referrer,
                factory
            );

        // trader can now commit a new order
        asyncOrder.reset();

        // emit event
        emit OrderSettled(
            runtime.marketId,
            runtime.accountId,
            runtime.fillPrice,
            runtime.pnl,
            runtime.accruedFunding,
            runtime.sizeDelta,
            runtime.newPositionSize,
            runtime.totalFees,
            runtime.referralFees,
            runtime.feeCollectorFees,
            runtime.settlementReward,
            asyncOrder.request.trackingCode,
            ERC2771Context._msgSender()
        );
    }
}
