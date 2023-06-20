//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {IPythVerifier} from "../interfaces/external/IPythVerifier.sol";
import {IAsyncOrderModule} from "../interfaces/IAsyncOrderModule.sol";
import {PerpsAccount, SNX_USD_MARKET_ID} from "../storage/PerpsAccount.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {Position} from "../storage/Position.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";

contract AsyncOrderModule is IAsyncOrderModule {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using PerpsPrice for PerpsPrice.Data;
    using AsyncOrder for AsyncOrder.Data;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarket for PerpsMarket.Data;
    using AsyncOrder for AsyncOrder.Data;
    using SettlementStrategy for SettlementStrategy.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using Position for Position.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    int256 public constant PRECISION = 18;

    function commitOrder(
        AsyncOrder.OrderCommitmentRequest memory commitment
    ) external override returns (AsyncOrder.Data memory retOrder, uint fees) {
        PerpsMarket.Data storage market = PerpsMarket.loadValid(commitment.marketId);

        // Check if commitment.accountId is valid
        Account.exists(commitment.accountId);

        // TODO Check msg.sender can commit order for commitment.accountId

        GlobalPerpsMarket.load().checkLiquidation(commitment.accountId);

        AsyncOrder.Data storage order = market.asyncOrders[commitment.accountId];

        if (order.sizeDelta != 0) {
            revert OrderAlreadyCommitted(commitment.marketId, commitment.accountId);
        }

        SettlementStrategy.Data storage strategy = PerpsMarketConfiguration
            .load(commitment.marketId)
            .settlementStrategy;

        uint256 settlementTime = block.timestamp + strategy.settlementDelay;
        order.update(commitment, settlementTime);

        // TODO: should this use settlement or current price?
        (, uint feesAccrued, , ) = order.validateOrder(
            strategy,
            PerpsPrice.getSettlementPrice(commitment.marketId)
        );

        // TODO include fees in event
        emit OrderCommitted(
            commitment.marketId,
            commitment.accountId,
            commitment.sizeDelta,
            commitment.acceptablePrice,
            settlementTime,
            settlementTime + strategy.settlementWindowDuration,
            commitment.trackingCode,
            msg.sender
        );

        return (order, feesAccrued);
    }

    function settle(
        uint128 marketId,
        uint128 accountId
    ) external override returns (int128 newPositionSize, int256 pnl, uint256 totalFees) {
        GlobalPerpsMarket.load().checkLiquidation(accountId);
        (
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = _performOrderValidityChecks(marketId, accountId);

        return _settleOrder(PerpsPrice.getSettlementPrice(marketId), order, settlementStrategy);
    }

    function _settleOrder(
        uint256 price,
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private returns (int128, int256, uint256) {
        SettleOrderRuntime memory runtime;

        runtime.accountId = asyncOrder.accountId;
        runtime.marketId = asyncOrder.marketId;

        // check if account is flagged
        GlobalPerpsMarket.load().checkLiquidation(runtime.accountId);
        (
            Position.Data memory newPosition,
            uint totalFees,
            uint fillPrice,
            Position.Data storage oldPosition
        ) = asyncOrder.validateOrder(settlementStrategy, price);

        runtime.newPositionSize = newPosition.size;

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        PerpsAccount.Data storage perpsAccount = PerpsAccount.load(runtime.accountId);
        // use fill price to calculate realized pnl
        (runtime.pnl, , , ) = oldPosition.getPnl(fillPrice);

        runtime.pnlUint = MathUtil.abs(runtime.pnl);
        if (runtime.pnl > 0) {
            factory.synthetix.withdrawMarketUsd(runtime.marketId, address(this), runtime.pnlUint);
            perpsAccount.addCollateralAmount(SNX_USD_MARKET_ID, runtime.pnlUint);
        } else if (runtime.pnl < 0) {
            perpsAccount.deductFromAccount(runtime.pnlUint);
            runtime.amountToDeposit = runtime.pnlUint;
            // all gets deposited below with fees
        }

        // after pnl is realized, update position
        PerpsMarket.loadValid(runtime.marketId).updatePositionData(runtime.accountId, newPosition);

        perpsAccount.updatePositionMarkets(runtime.marketId, runtime.newPositionSize);
        perpsAccount.deductFromAccount(totalFees);

        runtime.settlementReward = settlementStrategy.settlementReward;
        runtime.amountToDeposit += totalFees - runtime.settlementReward;
        if (runtime.settlementReward > 0) {
            // pay keeper
            factory.usdToken.transfer(msg.sender, runtime.settlementReward);
        }

        if (runtime.amountToDeposit > 0) {
            // deposit into market manager
            factory.depositToMarketManager(runtime.marketId, runtime.amountToDeposit);
        }

        // exctracted from asyncOrder before order is reset
        bytes32 trackingCode = asyncOrder.trackingCode;

        asyncOrder.reset();

        // emit event
        emit OrderSettled(
            runtime.marketId,
            runtime.accountId,
            fillPrice,
            runtime.pnl,
            runtime.newPositionSize,
            totalFees,
            runtime.settlementReward,
            trackingCode,
            msg.sender
        );

        return (runtime.newPositionSize, runtime.pnl, totalFees);
    }

    function _performOrderValidityChecks(
        uint128 marketId,
        uint128 accountId
    ) private view returns (AsyncOrder.Data storage, SettlementStrategy.Data storage) {
        AsyncOrder.Data storage order = PerpsMarket.loadValid(marketId).asyncOrders[accountId];
        SettlementStrategy.Data storage settlementStrategy = PerpsMarketConfiguration
            .load(marketId)
            .settlementStrategy;

        order.checkValidity();
        order.checkWithinSettlementWindow(settlementStrategy);

        return (order, settlementStrategy);
    }
}
