//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/AsyncOrderConfiguration.sol";
import "../storage/AsyncOrder.sol";
import "../storage/SettlementStrategy.sol";
import "../interfaces/IAsyncOrderModule.sol";
import "../utils/AsyncOrderClaimTokenUtil.sol";
import "../utils/FeeUtil.sol";
import "../interfaces/external/IChainlinkVerifier.sol";
import "../interfaces/external/IPythVerifier.sol";

import "hardhat/console.sol";

/**
 * @title Module to process asyncronous orders
 * @notice See README.md for an overview of asyncronous orders
 * @dev See IAsyncOrderModule.
 */
contract AsyncOrderModule is IAsyncOrderModule {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;
    using DecimalMath for int64;
    using AsyncOrder for AsyncOrder.Data;
    using AsyncOrderConfiguration for AsyncOrderConfiguration.Data;
    using AsyncOrderClaim for AsyncOrderClaim.Data;
    using SettlementStrategy for SettlementStrategy.Data;

    int256 public constant PRECISION = 18;

    // ************
    // COMMITMENT
    // ************

    function commitOrder(
        uint128 marketId,
        SpotMarketFactory.TransactionType orderType,
        uint256 amountProvided,
        uint256 settlementStrategyId,
        uint256 minimumSettlementAmount
    )
        external
        override
        returns (uint128 asyncOrderId, AsyncOrderClaim.Data memory asyncOrderClaim)
    {
        SpotMarketFactory.load().isValidMarket(marketId);
        SpotMarketFactory.isValidAsyncTransaction(orderType);
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );
        asyncOrderConfiguration.isValidSettlementStrategy(settlementStrategyId);

        int256 committedAmountUsd;
        uint amountEscrowed;
        if (orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            asyncOrderConfiguration.isValidAmount(settlementStrategyId, amountProvided);
            SpotMarketFactory.load().usdToken.transferFrom(
                msg.sender,
                address(this),
                amountProvided
            );

            committedAmountUsd = amountProvided.toInt();
            amountEscrowed = amountProvided;
        }

        if (orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            // Get the dollar value of the provided synths
            uint256 usdAmount = Price.synthUsdExchangeRate(
                marketId,
                amountProvided,
                SpotMarketFactory.TransactionType.SELL
            );

            asyncOrderConfiguration.isValidAmount(settlementStrategyId, usdAmount);

            amountEscrowed = AsyncOrder.transferIntoEscrow(marketId, msg.sender, amountProvided);

            committedAmountUsd = -1 * usdAmount.toInt();
        }

        // Adjust async order data
        AsyncOrder.Data storage asyncOrderData = AsyncOrder.load(marketId);
        asyncOrderId = ++asyncOrderData.totalClaims;
        asyncOrderData.totalCommittedUsdAmount += committedAmountUsd;

        uint settlementDelay = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[settlementStrategyId]
            .settlementDelay;

        asyncOrderClaim = AsyncOrderClaim.create(
            marketId,
            asyncOrderId,
            orderType,
            amountEscrowed,
            settlementStrategyId,
            block.timestamp + settlementDelay,
            committedAmountUsd,
            minimumSettlementAmount,
            msg.sender
        );

        // Emit event
        emit OrderCommitted(marketId, orderType, amountProvided, asyncOrderId, msg.sender);
    }

    // ************
    // SETTLEMENT
    // ************

    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external override returns (uint, int, uint) {
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        SettlementStrategy.Data storage settlementStrategy = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[asyncOrderClaim.settlementStrategyId];

        asyncOrderClaim.checkSettlementValidity(asyncOrderId, settlementStrategy);

        if (settlementStrategy.strategyType == SettlementStrategy.Type.ONCHAIN) {
            return
                _settleOrder(
                    marketId,
                    asyncOrderId,
                    Price.getCurrentPrice(marketId, asyncOrderClaim.orderType),
                    asyncOrderClaim,
                    settlementStrategy
                );
        } else {
            return _settleOffchain(marketId, asyncOrderId, asyncOrderClaim, settlementStrategy);
        }
    }

    function settleChainlinkOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external returns (uint, int, uint) {
        (uint128 marketId, uint128 asyncOrderId) = abi.decode(extraData, (uint128, uint128));
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        SettlementStrategy.Data storage settlementStrategy = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[asyncOrderClaim.settlementStrategyId];

        asyncOrderClaim.checkSettlementValidity(asyncOrderId, settlementStrategy);

        bytes memory verifierResponse = IChainlinkVerifier(
            settlementStrategy.priceVerificationContract
        ).verify(result);

        (
            bytes32 feedId,
            uint32 observationsTimestamp,
            uint64 observationsBlocknumber,
            int192 median // TODO: why is this int192? decimals?
        ) = abi.decode(verifierResponse, (bytes32, uint32, uint64, int192));

        uint offchainPrice = uint(int(median)); // TODO: check this

        settlementStrategy.checkPriceDeviation(
            offchainPrice,
            Price.getCurrentPrice(marketId, asyncOrderClaim.orderType)
        );

        if (observationsTimestamp < asyncOrderClaim.settlementTime) {
            revert InvalidVerificationResponse();
        }

        return
            _settleOrder(
                marketId,
                asyncOrderId,
                offchainPrice,
                asyncOrderClaim,
                settlementStrategy
            );
    }

    function settlePythOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external returns (uint, int, uint) {
        (uint128 marketId, uint128 asyncOrderId) = abi.decode(extraData, (uint128, uint128));
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        SettlementStrategy.Data storage settlementStrategy = AsyncOrderConfiguration
            .load(marketId)
            .settlementStrategies[asyncOrderClaim.settlementStrategyId];

        asyncOrderClaim.checkSettlementValidity(asyncOrderId, settlementStrategy);

        bytes8 time = abi.decode(result[:32], (bytes8));

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = settlementStrategy.feedId;

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = abi.encodePacked(result[:32]);

        IPythVerifier.PriceFeed[] memory priceFeeds = IPythVerifier(
            settlementStrategy.priceVerificationContract
        ).parsePriceFeedUpdates(
                updateData,
                priceIds,
                uint64(asyncOrderClaim.settlementTime), // TODO: safe conversion
                uint64(asyncOrderClaim.settlementTime + settlementStrategy.settlementWindowDuration)
            );

        IPythVerifier.PriceFeed memory pythData = priceFeeds[0];
        uint offchainPrice = _getScaledPrice(pythData.price.price, pythData.price.expo).toUint();

        settlementStrategy.checkPriceDeviation(
            offchainPrice,
            Price.getCurrentPrice(marketId, asyncOrderClaim.orderType)
        );

        uint publishTime = uint(priceFeeds[0].price.publishTime);

        return
            _settleOrder(
                marketId,
                asyncOrderId,
                offchainPrice,
                asyncOrderClaim,
                settlementStrategy
            );
    }

    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external override {
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        asyncOrderClaim.isEligibleForCancellation(
            asyncOrderConfiguration.settlementStrategies[asyncOrderClaim.settlementStrategyId]
        );

        _issueRefund(marketId, asyncOrderId, asyncOrderClaim);
    }

    function _settleOrder(
        uint128 marketId,
        uint128 asyncOrderId,
        uint price,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private returns (uint finalOrderAmount, int totalFees, uint collectedFees) {
        // adjust commitment amount prior to fee calculation (used for skew/utilization calcs)
        AsyncOrder.load(marketId).totalCommittedUsdAmount -= asyncOrderClaim.committedAmountUsd;

        asyncOrderClaim.settledAt = block.timestamp;

        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            (finalOrderAmount, totalFees, collectedFees) = _settleBuyOrder(
                marketId,
                price,
                asyncOrderClaim,
                settlementStrategy
            );
        }

        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            (finalOrderAmount, totalFees, collectedFees) = _settleSellOrder(
                marketId,
                price,
                asyncOrderClaim,
                settlementStrategy
            );
        }

        // Emit event
        emit OrderSettled(
            marketId,
            asyncOrderId,
            finalOrderAmount,
            totalFees, // TODO: should this include settlement reward?
            collectedFees,
            msg.sender
        );
    }

    function _settleBuyOrder(
        uint128 marketId,
        uint price,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private returns (uint finalOrderAmount, int totalFees, uint collectedFees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        // remove keeper fee
        uint amountUsable = asyncOrderClaim.amountEscrowed - settlementStrategy.settlementReward;
        address trader = asyncOrderClaim.settlementAddress;

        uint finalAmountUsd;
        (finalAmountUsd, totalFees, collectedFees) = FeeUtil.processFees(
            marketId,
            trader,
            amountUsable,
            SpotMarketFactory.TransactionType.ASYNC_BUY
        );

        finalOrderAmount = finalAmountUsd.divDecimal(price);

        if (finalOrderAmount < asyncOrderClaim.minimumSettlementAmount) {
            revert MinimumSettlementAmountNotMet(
                asyncOrderClaim.minimumSettlementAmount,
                finalOrderAmount
            );
        }

        ITokenModule(spotMarketFactory.usdToken).transfer(
            msg.sender,
            settlementStrategy.settlementReward
        );

        spotMarketFactory.depositToMarketManager(marketId, finalAmountUsd);

        SynthUtil.getToken(marketId).mint(trader, finalOrderAmount);
    }

    function _settleSellOrder(
        uint128 marketId,
        uint price,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private returns (uint finalOrderAmount, int totalFees, uint collectedFees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        uint synthAmount = AsyncOrder.load(marketId).convertSharesToSynth(
            marketId,
            asyncOrderClaim.amountEscrowed
        );

        address trader = asyncOrderClaim.settlementAddress;

        // TODO: AtomicSell is the same, consolidate into OrderUtil? (same for buy above)
        uint usableAmount = synthAmount.mulDecimal(price) - settlementStrategy.settlementReward;

        (finalOrderAmount, totalFees) = FeeUtil.calculateFees(
            marketId,
            trader,
            usableAmount,
            SpotMarketFactory.TransactionType.ASYNC_SELL
        );

        // burn after fee calculation to avoid before/after fill calculations
        AsyncOrder.burnFromEscrow(marketId, asyncOrderClaim.amountEscrowed);

        if (finalOrderAmount < asyncOrderClaim.minimumSettlementAmount) {
            revert MinimumSettlementAmountNotMet(
                asyncOrderClaim.minimumSettlementAmount,
                finalOrderAmount
            );
        }

        if (totalFees > 0) {
            // withdraw fees
            IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
                marketId,
                address(this),
                totalFees.toUint()
            );

            // collect fees
            collectedFees = FeeUtil.collectFees(
                marketId,
                totalFees,
                msg.sender,
                SpotMarketFactory.TransactionType.SELL
            );
        }

        // send keeper it's reward
        IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
            marketId,
            msg.sender,
            settlementStrategy.settlementReward
        );

        IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
            marketId,
            trader,
            finalOrderAmount
        );
    }

    function _settleOffchain(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private view returns (uint, int256, uint256) {
        string[] memory urls = new string[](1);
        urls[0] = settlementStrategy.url;

        bytes4 selector;
        if (settlementStrategy.strategyType == SettlementStrategy.Type.CHAINLINK) {
            selector = AsyncOrderModule.settleChainlinkOrder.selector;
        } else if (settlementStrategy.strategyType == SettlementStrategy.Type.PYTH) {
            selector = AsyncOrderModule.settlePythOrder.selector;
        } else {
            revert SettlementStrategyNotFound(settlementStrategy.strategyType);
        }

        revert OffchainLookup(
            address(this),
            urls,
            abi.encodePacked(
                settlementStrategy.feedId,
                _getTimeInBytes(asyncOrderClaim.settlementTime)
            ),
            selector,
            abi.encode(marketId, asyncOrderId)
        );
    }

    function _issueRefund(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data storage asyncOrderClaim
    ) private {
        address trader = asyncOrderClaim.settlementAddress;
        // Return escrowed funds after keeping the fee
        if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_BUY) {
            ITokenModule(SpotMarketFactory.load().usdToken).transfer(
                trader,
                asyncOrderClaim.amountEscrowed
            );
        } else if (asyncOrderClaim.orderType == SpotMarketFactory.TransactionType.ASYNC_SELL) {
            AsyncOrder.transferFromEscrow(marketId, trader, asyncOrderClaim.amountEscrowed);
        }

        // Commitment amount accounting
        AsyncOrder.load(marketId).totalCommittedUsdAmount -= asyncOrderClaim.committedAmountUsd;

        // Emit event
        emit OrderCancelled(marketId, asyncOrderId, asyncOrderClaim, trader);
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
