//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IAsyncOrderSettlementModule} from "../interfaces/IAsyncOrderSettlementModule.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {IPythVerifier} from "../interfaces/external/IPythVerifier.sol";
import {PerpsAccount, SNX_USD_MARKET_ID} from "../storage/PerpsAccount.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {Position} from "../storage/Position.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";

/**
 * @title Module for settling async orders.
 * @dev See IAsyncOrderSettlementModule.
 */
contract AsyncOrderSettlementModule is IAsyncOrderSettlementModule, IMarketEvents {
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
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using Position for Position.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    int256 public constant PRECISION = 18;

    /**
     * @inheritdoc IAsyncOrderSettlementModule
     */
    function settle(uint128 accountId) external view {
        GlobalPerpsMarket.load().checkLiquidation(accountId);
        (
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = AsyncOrder.loadValid(accountId);

        _settleOffchain(order, settlementStrategy);
    }

    /**
     * @inheritdoc IAsyncOrderSettlementModule
     */
    function settlePythOrder(bytes calldata result, bytes calldata extraData) external payable {
        uint128 accountId = abi.decode(extraData, (uint128));
        (
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = AsyncOrder.loadValid(accountId);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = settlementStrategy.feedId;

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = result;

        IPythVerifier.PriceFeed[] memory priceFeeds = IPythVerifier(
            settlementStrategy.priceVerificationContract
        ).parsePriceFeedUpdates{value: msg.value}(
            updateData,
            priceIds,
            order.settlementTime.to64(),
            (order.settlementTime + settlementStrategy.priceWindowDuration).to64()
        );

        IPythVerifier.PriceFeed memory pythData = priceFeeds[0];
        uint offchainPrice = _getScaledPrice(pythData.price.price, pythData.price.expo).toUint();

        settlementStrategy.checkPriceDeviation(
            offchainPrice,
            PerpsPrice.getCurrentPrice(order.request.marketId)
        );

        _settleOrder(offchainPrice, order, settlementStrategy);
    }

    /**
     * @dev used for settleing offchain orders. This will revert with OffchainLookup.
     */
    function _settleOffchain(
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private view returns (uint, int256, uint256) {
        string[] memory urls = new string[](1);
        urls[0] = settlementStrategy.url;

        bytes4 selector;
        if (settlementStrategy.strategyType == SettlementStrategy.Type.PYTH) {
            selector = AsyncOrderSettlementModule.settlePythOrder.selector;
        } else {
            revert SettlementStrategyNotFound(settlementStrategy.strategyType);
        }

        // see EIP-3668: https://eips.ethereum.org/EIPS/eip-3668
        revert OffchainLookup(
            address(this),
            urls,
            abi.encodePacked(settlementStrategy.feedId, _getTimeInBytes(asyncOrder.settlementTime)),
            selector,
            abi.encode(asyncOrder.request.accountId) // extraData that gets sent to callback for validation
        );
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

        runtime.amountToDeduct += runtime.totalFees;

        runtime.newPositionSize = runtime.newPosition.size;
        runtime.sizeDelta = asyncOrder.request.sizeDelta;

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        PerpsAccount.Data storage perpsAccount = PerpsAccount.load(runtime.accountId);

        // use fill price to calculate realized pnl
        (runtime.pnl, , , runtime.accruedFunding, ) = oldPosition.getPnl(runtime.fillPrice);
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
            perpsAccount.deductFromAccount(runtime.amountToDeduct);
        }
        runtime.settlementReward = settlementStrategy.settlementReward;

        if (runtime.settlementReward > 0) {
            // pay keeper
            factory.withdrawMarketUsd(msg.sender, runtime.settlementReward);
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
            msg.sender
        );
    }

    /**
     * @dev converts the settlement time into bytes8.
     */
    function _getTimeInBytes(uint256 settlementTime) private pure returns (bytes8) {
        bytes32 settlementTimeBytes = bytes32(abi.encode(settlementTime));

        // get last 8 bytes
        return bytes8(settlementTimeBytes << 192);
    }

    /**
     * @dev gets scaled price. Borrowed from PythNode.sol.
     */
    function _getScaledPrice(int64 price, int32 expo) private pure returns (int256) {
        int256 factor = PRECISION + expo;
        return factor > 0 ? price.upscale(factor.toUint()) : price.downscale((-factor).toUint());
    }
}
