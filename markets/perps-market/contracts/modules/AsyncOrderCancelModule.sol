//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {IAsyncOrderCancelModule} from "../interfaces/IAsyncOrderCancelModule.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {IPythVerifier} from "../interfaces/external/IPythVerifier.sol";
import {PerpsAccount, SNX_USD_MARKET_ID} from "../storage/PerpsAccount.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {Position} from "../storage/Position.sol";
import {PerpsMarketConfiguration} from "../storage/PerpsMarketConfiguration.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {PerpsMarketFactory} from "../storage/PerpsMarketFactory.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {IMarketEvents} from "../interfaces/IMarketEvents.sol";

/**
 * @title Module for cancelling async orders.
 * @dev See IAsyncOrderCancelModule.
 */
contract AsyncOrderCancelModule is IAsyncOrderCancelModule, IMarketEvents {
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

    int256 private constant PRECISION = 18;

    /**
     * @inheritdoc IAsyncOrderCancelModule
     */
    function cancelOrder(uint128 accountId) external view {
        GlobalPerpsMarket.load().checkLiquidation(accountId);
        (
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = AsyncOrder.loadValid(accountId);

        _cancelOffchain(order, settlementStrategy);
    }

    /**
     * @inheritdoc IAsyncOrderCancelModule
     */
    function cancelPythOrder(bytes calldata result, bytes calldata extraData) external payable {
        (
            uint256 offchainPrice,
            AsyncOrder.Data storage order,
            SettlementStrategy.Data storage settlementStrategy
        ) = _parsePythPrice(result, extraData);

        _cancelOrder(offchainPrice, order, settlementStrategy);
    }

    /**
     * @dev used for canceling offchain orders. This will revert with OffchainLookup.
     */
    function _cancelOffchain(
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private view returns (uint, int256, uint256) {
        string[] memory urls = new string[](1);
        urls[0] = settlementStrategy.url;

        bytes4 selector;
        if (settlementStrategy.strategyType == SettlementStrategy.Type.PYTH) {
            selector = AsyncOrderCancelModule.cancelPythOrder.selector;
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
     * @dev used for canceling an order.
     */
    function _cancelOrder(
        uint256 price,
        AsyncOrder.Data storage asyncOrder,
        SettlementStrategy.Data storage settlementStrategy
    ) private {
        CancelOrderRuntime memory runtime;
        runtime.marketId = asyncOrder.request.marketId;
        runtime.accountId = asyncOrder.request.accountId;
        runtime.acceptablePrice = asyncOrder.request.acceptablePrice;
        runtime.settlementReward = settlementStrategy.settlementReward;
        runtime.sizeDelta = asyncOrder.request.sizeDelta;

        // check if account is flagged
        GlobalPerpsMarket.load().checkLiquidation(runtime.accountId);

        // Validate Request
        if (runtime.sizeDelta == 0) {
            revert AsyncOrder.ZeroSizeOrder();
        }

        PerpsAccount.Data storage account = PerpsAccount.load(runtime.accountId);

        bool isEligible;
        (isEligible, runtime.currentAvailableMargin, , , , ) = account.isEligibleForLiquidation();

        if (isEligible) {
            revert PerpsAccount.AccountLiquidatable(runtime.accountId);
        }

        PerpsMarket.Data storage perpsMarketData = PerpsMarket.load(runtime.marketId);
        perpsMarketData.recomputeFunding(price);

        PerpsMarketConfiguration.Data storage marketConfig = PerpsMarketConfiguration.load(
            runtime.marketId
        );

        runtime.fillPrice = AsyncOrder.calculateFillPrice(
            perpsMarketData.skew,
            marketConfig.skewScale,
            runtime.sizeDelta,
            price
        );

        // check if price exceeded acceptable price
        if (!asyncOrder.acceptablePriceExceeded(runtime.fillPrice)) {
            revert PriceNotExceeded(runtime.fillPrice, runtime.acceptablePrice);
        }

        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

        // check if there's enough margin to pay keeper
        if (runtime.currentAvailableMargin < runtime.settlementReward.toInt()) {
            revert AsyncOrder.InsufficientMargin(
                runtime.currentAvailableMargin,
                runtime.settlementReward
            );
        }

        if (runtime.settlementReward > 0) {
            // deduct keeper reward
            account.deductFromAccount(runtime.settlementReward);
            // pay keeper
            factory.withdrawMarketUsd(ERC2771Context._msgSender(), runtime.settlementReward);
        }

        // trader can now commit a new order
        asyncOrder.reset();

        // emit event
        emit OrderCancelled(
            runtime.marketId,
            runtime.accountId,
            runtime.acceptablePrice,
            runtime.fillPrice,
            runtime.sizeDelta,
            runtime.settlementReward,
            asyncOrder.request.trackingCode,
            ERC2771Context._msgSender()
        );
    }

    /**
     * @dev parses the result from the offchain lookup data and returns the offchain price plus order and settlementStrategy.
     */
    function _parsePythPrice(
        bytes calldata result,
        bytes calldata extraData
    )
        private
        returns (
            uint256 offchainPrice,
            AsyncOrder.Data storage asyncOrder,
            SettlementStrategy.Data storage settlementStrategy
        )
    {
        uint128 accountId = abi.decode(extraData, (uint128));
        (asyncOrder, settlementStrategy) = AsyncOrder.loadValid(accountId);

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = settlementStrategy.feedId;

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = result;

        IPythVerifier verifier = IPythVerifier(settlementStrategy.priceVerificationContract);
        uint256 msgValue = verifier.getUpdateFee(1);

        IPythVerifier.PriceFeed[] memory priceFeeds = IPythVerifier(
            settlementStrategy.priceVerificationContract
        ).parsePriceFeedUpdates{value: msgValue}(
            updateData,
            priceIds,
            asyncOrder.settlementTime.to64(),
            (asyncOrder.settlementTime + settlementStrategy.priceWindowDuration).to64()
        );

        IPythVerifier.PriceFeed memory pythData = priceFeeds[0];
        offchainPrice = _getScaledPrice(pythData.price.price, pythData.price.expo).toUint();
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
