//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {IPythVerifier} from "../interfaces/external/IPythVerifier.sol";
import {IAccountModule} from "../interfaces/IAccountModule.sol";
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

/**
 * @title Module for committing and settling async orders.
 * @dev See IAsyncOrderModule.
 */
contract AsyncOrderModule is IAsyncOrderModule {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using PerpsPrice for PerpsPrice.Data;
    using PerpsAccount for PerpsAccount.Data;
    using PerpsMarket for PerpsMarket.Data;
    using AsyncOrder for AsyncOrder.Data;
    using SettlementStrategy for SettlementStrategy.Data;
    using PerpsMarketFactory for PerpsMarketFactory.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using Position for Position.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using PerpsAccount for PerpsAccount.Data;

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function commitOrder(
        AsyncOrder.OrderCommitmentRequest memory commitment
    ) external override returns (AsyncOrder.Data memory retOrder, uint fees) {
        PerpsMarket.loadValid(commitment.marketId);

        // Check if commitment.accountId is valid
        Account.exists(commitment.accountId);

        // Check msg.sender can commit order for commitment.accountId
        Account.loadAccountAndValidatePermission(
            commitment.accountId,
            AccountRBAC._PERPS_COMMIT_ASYNC_ORDER_PERMISSION
        );

        GlobalPerpsMarket.load().checkLiquidation(commitment.accountId);

        AsyncOrder.Data storage order = AsyncOrder.createValid(
            commitment.accountId,
            commitment.marketId
        );

        SettlementStrategy.Data storage strategy = PerpsMarketConfiguration
            .load(commitment.marketId)
            .loadValidSettlementStrategy(commitment.settlementStrategyId);

        uint256 settlementTime = block.timestamp + strategy.settlementDelay;
        order.update(commitment, settlementTime);

        (, uint feesAccrued, , ) = order.validateOrder(
            strategy,
            PerpsPrice.getCurrentPrice(commitment.marketId)
        );

        // TODO include fees in event
        emit OrderCommitted(
            commitment.marketId,
            commitment.accountId,
            strategy.strategyType,
            commitment.sizeDelta,
            commitment.acceptablePrice,
            settlementTime,
            settlementTime + strategy.settlementWindowDuration,
            commitment.trackingCode,
            msg.sender
        );

        return (order, feesAccrued);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function getOrder(
        uint128 marketId,
        uint128 accountId
    ) external view override returns (AsyncOrder.Data memory order) {
        order = AsyncOrder.load(accountId);
        if (order.marketId != marketId) {
            // return emtpy order if marketId does not match
            order = AsyncOrder.Data(0, 0, 0, 0, 0, 0, 0);
        }
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function cancelOrder(uint128 marketId, uint128 accountId) external override {
        AsyncOrder.Data storage order = AsyncOrder.loadValid(accountId, marketId);

        SettlementStrategy.Data storage settlementStrategy = PerpsMarketConfiguration
            .load(marketId)
            .settlementStrategies[order.settlementStrategyId];
        order.checkCancellationEligibility(settlementStrategy);
        order.reset();

        emit OrderCanceled(marketId, accountId, order.settlementTime, order.acceptablePrice);
    }

    function _settleOffchain(
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private view returns (uint, int256, uint256) {
        string[] memory urls = new string[](1);
        urls[0] = settlementStrategy.url;

        bytes4 selector;
        if (settlementStrategy.strategyType == SettlementStrategy.Type.PYTH) {
            selector = AsyncOrderModule.settlePythOrder.selector;
        } else {
            revert SettlementStrategyNotFound(settlementStrategy.strategyType);
        }

        // see EIP-3668: https://eips.ethereum.org/EIPS/eip-3668
        revert OffchainLookup(
            address(this),
            urls,
            abi.encodePacked(settlementStrategy.feedId, _getTimeInBytes(asyncOrder.settlementTime)),
            selector,
            abi.encode(asyncOrder.marketId, asyncOrder.accountId) // extraData that gets sent to callback for validation
        );
    }

    function _settleOrder(
        uint256 price,
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private {
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
        }

        // after pnl is realized, update position
        PerpsMarket.loadValid(runtime.marketId).updatePositionData(runtime.accountId, newPosition);

        perpsAccount.updateOpenPositions(runtime.marketId, runtime.newPositionSize);
        // since margin is deposited, as long as the owed collateral is deducted
        // fees are realized by the stakers
        perpsAccount.deductFromAccount(totalFees);

        runtime.settlementReward = settlementStrategy.settlementReward;
        if (runtime.settlementReward > 0) {
            // pay keeper
            factory.synthetix.withdrawMarketUsd(
                factory.perpsMarketId,
                msg.sender,
                runtime.settlementReward
            );
        }

        // exctracted from asyncOrder before order is reset
        bytes32 trackingCode = asyncOrder.trackingCode;

        // trader can now commit a new order
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
    }

    function _performOrderValidityChecks(
        uint128 marketId,
        uint128 accountId
    ) private view returns (AsyncOrder.Data storage, SettlementStrategy.Data storage) {
        AsyncOrder.Data storage order = PerpsMarket.loadValid(marketId).asyncOrders[accountId];
        SettlementStrategy.Data storage settlementStrategy = PerpsMarketConfiguration
            .load(marketId)
            .settlementStrategies[order.settlementStrategyId];

        order.checkValidity();
        order.checkWithinSettlementWindow(settlementStrategy);

        return (order, settlementStrategy);
    }

    function _getTimeInBytes(uint256 settlementTime) private pure returns (bytes8) {
        bytes32 settlementTimeBytes = bytes32(abi.encode(settlementTime));

        // get last 8 bytes
        return bytes8(settlementTimeBytes << 192);
    }

    // borrowed from PythNode.sol
    function _getScaledPrice(int64 price, int32 expo) private pure returns (int256) {
        int256 factor = PRECISION + expo;
        return factor > 0 ? price.upscale(factor.toUint()) : price.downscale((-factor).toUint());
    }
}
