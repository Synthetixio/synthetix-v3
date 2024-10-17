//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {IAsyncOrderSettlementPythModule} from "../interfaces/IAsyncOrderSettlementPythModule.sol";
import {PerpsAccount, SNX_USD_MARKET_ID} from "../storage/PerpsAccount.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Flags} from "../utils/Flags.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {Position} from "../storage/Position.sol";
import {MarketUpdate} from "../storage/MarketUpdate.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";
import {IAccountEvents} from "../interfaces/IAccountEvents.sol";
import {KeeperCosts} from "../storage/KeeperCosts.sol";
import {IPythERC7412Wrapper} from "../interfaces/external/IPythERC7412Wrapper.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

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

        int256 offchainPrice = IPythERC7412Wrapper(settlementStrategy.priceVerificationContract)
            .getBenchmarkPrice(
                settlementStrategy.feedId,
                (asyncOrder.commitmentTime + settlementStrategy.commitmentPriceDelay).to64()
            );

        _settleOrder(offchainPrice.toUint(), asyncOrder, settlementStrategy);
    }

    /**
     * @notice Settles an offchain order
     * @param price provided by offchain oracle
     * @param asyncOrder to be validated and settled
     * @param settlementStrategy used to validate order and calculate settlement reward
     */
    function _settleOrder(
        uint256 price,
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private {
        /// @dev runtime stores order settlement data; circumvents stack limitations
        SettleOrderRuntime memory runtime;

        runtime.accountId = asyncOrder.request.accountId;
        runtime.marketId = asyncOrder.request.marketId;
        runtime.sizeDelta = asyncOrder.request.sizeDelta;

        GlobalPerpsMarket.load().checkLiquidation(runtime.accountId);

        Position.Data storage oldPosition;

        // Load the market before settlement to capture the original market size
        PerpsMarket.Data storage market = PerpsMarket.loadValid(runtime.marketId);
        uint256 originalMarketSize = market.size;

        // validate order request can be settled; call reverts if not
        (runtime.newPosition, runtime.totalFees, runtime.fillPrice, oldPosition) = asyncOrder
            .validateRequest(settlementStrategy, price);

        // validate final fill price is acceptable relative to price specified by trader
        asyncOrder.validateAcceptablePrice(runtime.fillPrice);

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        PerpsAccount.Data storage perpsAccount = PerpsAccount.load(runtime.accountId);

        // use actual fill price to calculate realized pnl
        (runtime.pnl, , runtime.chargedInterest, runtime.accruedFunding, , ) = oldPosition.getPnl(
            runtime.fillPrice
        );

        runtime.chargedAmount = runtime.pnl - runtime.totalFees.toInt();
        perpsAccount.charge(runtime.chargedAmount);

        emit AccountCharged(runtime.accountId, runtime.chargedAmount, perpsAccount.debt);

        // only update position state after pnl has been realized
        runtime.updateData = _processPositionUpdate(price, runtime, market, originalMarketSize);
        perpsAccount.updateOpenPositions(runtime.marketId, runtime.newPosition.size);

        runtime.settlementReward = AsyncOrder.settlementRewardCost(settlementStrategy);

        // Process fees
        _processFees(runtime, asyncOrder, factory);

        // Emit events in a helper function
        _emitSettlementEvents(runtime, asyncOrder);

        // Reset the async order
        asyncOrder.reset();
    }

    /// @dev Updates the position and market data
    function _processPositionUpdate(
        uint256 price,
        SettleOrderRuntime memory runtime,
        PerpsMarket.Data storage market,
        uint256 originalMarketSize
    ) internal returns (MarketUpdate.Data memory) {
        // Update position data
        MarketUpdate.Data memory updateData = market.updatePositionData(
            runtime.accountId,
            runtime.newPosition
        );

        // Calculate the market size delta (change in market size)
        int256 marketSizeDelta = market.size.toInt() - originalMarketSize.toInt();

        // Emit MarketUpdated event
        emit MarketUpdated(
            updateData.marketId,
            price,
            updateData.skew,
            market.size,
            marketSizeDelta,
            updateData.currentFundingRate,
            updateData.currentFundingVelocity,
            updateData.interestRate
        );

        return updateData;
    }

    /// @dev Processes the order fees and settlement rewards
    function _processFees(
        SettleOrderRuntime memory runtime,
        AsyncOrder.Data storage asyncOrder,
        PerpsMarketFactory.Data storage factory
    ) internal {
        // if settlement reward is non-zero, pay keeper
        if (runtime.settlementReward > 0) {
            factory.withdrawMarketUsd(ERC2771Context._msgSender(), runtime.settlementReward);
        }

        // order fees are total fees minus settlement reward
        uint256 orderFees = runtime.totalFees - runtime.settlementReward;
        GlobalPerpsMarketConfiguration.Data storage s = GlobalPerpsMarketConfiguration.load();
        s.collectFees(orderFees, asyncOrder.request.referrer, factory);
    }

    /// @dev Emit settlement events in a helper function to reduce stack depth
    function _emitSettlementEvents(
        SettleOrderRuntime memory runtime,
        AsyncOrder.Data memory asyncOrder
    ) internal {
        emit InterestCharged(runtime.accountId, runtime.chargedInterest);

        emit OrderSettled(
            runtime.marketId,
            runtime.accountId,
            runtime.fillPrice,
            runtime.pnl,
            runtime.accruedFunding,
            runtime.sizeDelta,
            runtime.newPosition.size,
            runtime.totalFees,
            runtime.referralFees,
            runtime.feeCollectorFees,
            runtime.settlementReward,
            asyncOrder.request.trackingCode,
            ERC2771Context._msgSender()
        );
    }
}
