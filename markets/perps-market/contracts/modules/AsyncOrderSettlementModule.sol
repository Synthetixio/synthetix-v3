//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IAsyncOrderSettlementModule} from "../interfaces/IAsyncOrderSettlementModule.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
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
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";

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
    using PerpsMarketConfiguration for PerpsMarketConfiguration.Data;
    using Position for Position.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    int256 public constant PRECISION = 18;

    /**
     * @inheritdoc IAsyncOrderSettlementModule
     */
    function settle(uint128 marketId, uint128 accountId) external view {
        GlobalPerpsMarket.load().checkLiquidation(accountId);
        (
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = _performOrderValidityChecks(marketId, accountId);

        _settleOffchain(order, settlementStrategy);
    }

    /**
     * @inheritdoc IAsyncOrderSettlementModule
     */
    function settlePythOrder(bytes calldata result, bytes calldata extraData) external payable {
        (uint128 marketId, uint128 asyncOrderId) = abi.decode(extraData, (uint128, uint128));
        (
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = _performOrderValidityChecks(marketId, asyncOrderId);

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

        settlementStrategy.checkPriceDeviation(offchainPrice, PerpsPrice.getCurrentPrice(marketId));

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
            abi.encode(asyncOrder.marketId, asyncOrder.accountId) // extraData that gets sent to callback for validation
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

        runtime.amountToDeduct += totalFees;

        runtime.newPositionSize = newPosition.size;
        runtime.sizeDelta = asyncOrder.sizeDelta;

        runtime.factory = PerpsMarketFactory.load();
        PerpsAccount.Data storage perpsAccount = PerpsAccount.load(runtime.accountId);

        // use fill price to calculate realized pnl
        (runtime.pnl, , , ) = oldPosition.getPnl(fillPrice);
        runtime.pnlUint = MathUtil.abs(runtime.pnl);

        if (runtime.pnl > 0) {
            perpsAccount.updateCollateralAmount(SNX_USD_MARKET_ID, runtime.pnl);
        } else if (runtime.pnl < 0) {
            runtime.amountToDeduct += runtime.pnlUint;
        }

        // after pnl is realized, update position
        PerpsMarket.MarketUpdateData memory updateData = PerpsMarket
            .loadValid(runtime.marketId)
            .updatePositionData(runtime.accountId, newPosition);
        perpsAccount.updateOpenPositions(runtime.marketId, runtime.newPositionSize);

        emit MarketUpdated(
            updateData.marketId,
            price,
            updateData.skew,
            updateData.size,
            runtime.sizeDelta,
            updateData.currentFundingRate,
            updateData.currentFundingVelocity
        );

        // since margin is deposited, as long as the owed collateral is deducted
        // fees are realized by the stakers
        if (runtime.amountToDeduct > 0) {
            perpsAccount.deductFromAccount(runtime.amountToDeduct + totalFees);
        }
        runtime.settlementReward = settlementStrategy.settlementReward;

        if (runtime.settlementReward > 0) {
            // pay keeper
            runtime.factory.synthetix.withdrawMarketUsd(
                runtime.factory.perpsMarketId,
                msg.sender,
                runtime.settlementReward
            );
        }

        // trader can now commit a new order
        asyncOrder.reset();

        // emit event
        emit OrderSettled(
            runtime.marketId,
            runtime.accountId,
            fillPrice,
            runtime.pnl,
            runtime.sizeDelta,
            runtime.newPositionSize,
            totalFees,
            runtime.settlementReward,
            asyncOrder.trackingCode,
            msg.sender
        );
    }

    /**
     * @dev performs the order validity checks (existance and timing).
     */
    function _performOrderValidityChecks(
        uint128 marketId,
        uint128 accountId
    ) private view returns (AsyncOrder.Data storage, SettlementStrategy.Data storage) {
        AsyncOrder.Data storage order = AsyncOrder.loadValid(accountId, marketId);

        SettlementStrategy.Data storage settlementStrategy = PerpsMarketConfiguration
            .load(marketId)
            .settlementStrategies[order.settlementStrategyId];

        order.checkWithinSettlementWindow(settlementStrategy);

        return (order, settlementStrategy);
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
