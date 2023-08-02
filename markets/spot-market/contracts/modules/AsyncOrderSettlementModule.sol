//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IAsyncOrderSettlementModule} from "../interfaces/IAsyncOrderSettlementModule.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {IPythVerifier} from "../interfaces/external/IPythVerifier.sol";
import {AsyncOrderClaim} from "../storage/AsyncOrderClaim.sol";
import {Price} from "../storage/Price.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {OrderFees} from "../storage/OrderFees.sol";
import {Transaction} from "../utils/TransactionUtil.sol";
import {AsyncOrderConfiguration} from "../storage/AsyncOrderConfiguration.sol";
import {SpotMarketFactory} from "../storage/SpotMarketFactory.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {MarketConfiguration} from "../storage/MarketConfiguration.sol";
import {SynthUtil} from "../utils/SynthUtil.sol";

/**
 * @title Module to settle asyncronous orders
 * @notice See README.md for an overview of asyncronous orders
 * @dev See IAsyncOrderModule.
 */
contract AsyncOrderSettlementModule is IAsyncOrderSettlementModule {
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using SettlementStrategy for SettlementStrategy.Data;
    using MarketConfiguration for MarketConfiguration.Data;
    using AsyncOrder for AsyncOrder.Data;
    using AsyncOrderClaim for AsyncOrderClaim.Data;

    int256 public constant PRECISION = 18;

    /**
     * @inheritdoc IAsyncOrderSettlementModule
     */
    function settleOrder(
        uint128 marketId,
        uint128 asyncOrderId
    ) external override returns (uint256 finalOrderAmount, OrderFees.Data memory fees) {
        (
            AsyncOrderClaim.Data storage asyncOrderClaim,
            SettlementStrategy.Data storage settlementStrategy
        ) = _performClaimValidityChecks(marketId, asyncOrderId);

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

    /**
     * @inheritdoc IAsyncOrderSettlementModule
     */
    function settlePythOrder(
        bytes calldata result,
        bytes calldata extraData
    ) external payable returns (uint256 finalOrderAmount, OrderFees.Data memory fees) {
        (uint128 marketId, uint128 asyncOrderId) = abi.decode(extraData, (uint128, uint128));
        (
            AsyncOrderClaim.Data storage asyncOrderClaim,
            SettlementStrategy.Data storage settlementStrategy
        ) = _performClaimValidityChecks(marketId, asyncOrderId);

        if (settlementStrategy.strategyType != SettlementStrategy.Type.PYTH) {
            revert InvalidSettlementStrategy(settlementStrategy.strategyType);
        }

        bytes32[] memory priceIds = new bytes32[](1);
        priceIds[0] = settlementStrategy.feedId;

        bytes[] memory updateData = new bytes[](1);
        updateData[0] = result;

        IPythVerifier.PriceFeed[] memory priceFeeds = IPythVerifier(
            settlementStrategy.priceVerificationContract
        ).parsePriceFeedUpdates{value: msg.value}(
            updateData,
            priceIds,
            asyncOrderClaim.settlementTime.to64(),
            (asyncOrderClaim.settlementTime + settlementStrategy.settlementWindowDuration).to64()
        );

        IPythVerifier.PriceFeed memory pythData = priceFeeds[0];
        uint256 offchainPrice = _getScaledPrice(pythData.price.price, pythData.price.expo).toUint();

        settlementStrategy.checkPriceDeviation(
            offchainPrice,
            Price.getCurrentPrice(marketId, asyncOrderClaim.orderType)
        );

        return
            _settleOrder(
                marketId,
                asyncOrderId,
                offchainPrice,
                asyncOrderClaim,
                settlementStrategy
            );
    }

    /**
     * @dev Reusable logic used for settling orders once the appropriate checks are performed in calling functions.
     */
    function _settleOrder(
        uint128 marketId,
        uint128 asyncOrderId,
        uint256 price,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    ) private returns (uint256 finalOrderAmount, OrderFees.Data memory fees) {
        // set settledAt to avoid any potential reentrancy
        asyncOrderClaim.settledAt = block.timestamp;

        uint256 collectedFees;
        if (asyncOrderClaim.orderType == Transaction.Type.ASYNC_BUY) {
            (finalOrderAmount, fees, collectedFees) = _settleBuyOrder(
                marketId,
                price,
                settlementStrategy.settlementReward,
                asyncOrderClaim
            );
        }

        if (asyncOrderClaim.orderType == Transaction.Type.ASYNC_SELL) {
            (finalOrderAmount, fees, collectedFees) = _settleSellOrder(
                marketId,
                price,
                settlementStrategy.settlementReward,
                asyncOrderClaim
            );
        }

        emit OrderSettled(
            marketId,
            asyncOrderId,
            finalOrderAmount,
            fees,
            collectedFees,
            msg.sender,
            price,
            asyncOrderClaim.orderType
        );
    }

    /**
     * @dev logic for settling a buy order
     */
    function _settleBuyOrder(
        uint128 marketId,
        uint256 price,
        uint256 settlementReward,
        AsyncOrderClaim.Data storage asyncOrderClaim
    )
        private
        returns (uint256 returnSynthAmount, OrderFees.Data memory fees, uint256 collectedFees)
    {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        // remove keeper fee
        uint256 amountUsable = asyncOrderClaim.amountEscrowed - settlementReward;
        address trader = asyncOrderClaim.owner;

        MarketConfiguration.Data storage config;
        (returnSynthAmount, fees, config) = MarketConfiguration.quoteBuyExactIn(
            marketId,
            amountUsable,
            price,
            trader,
            Transaction.Type.ASYNC_BUY
        );

        if (returnSynthAmount < asyncOrderClaim.minimumSettlementAmount) {
            revert MinimumSettlementAmountNotMet(
                asyncOrderClaim.minimumSettlementAmount,
                returnSynthAmount
            );
        }

        collectedFees = config.collectFees(
            marketId,
            fees,
            trader,
            asyncOrderClaim.referrer,
            spotMarketFactory,
            Transaction.Type.ASYNC_BUY
        );
        if (settlementReward > 0) {
            ITokenModule(spotMarketFactory.usdToken).transfer(msg.sender, settlementReward);
        }
        spotMarketFactory.depositToMarketManager(marketId, amountUsable - collectedFees);
        SynthUtil.getToken(marketId).mint(trader, returnSynthAmount);
    }

    /**
     * @dev logic for settling a sell order
     */
    function _settleSellOrder(
        uint128 marketId,
        uint256 price,
        uint256 settlementReward,
        AsyncOrderClaim.Data storage asyncOrderClaim
    )
        private
        returns (uint256 finalOrderAmount, OrderFees.Data memory fees, uint256 collectedFees)
    {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        // get amount of synth from escrow
        // can't use amountEscrowed directly because the token could have decayed
        uint256 synthAmount = AsyncOrder.load(marketId).convertSharesToSynth(
            marketId,
            asyncOrderClaim.amountEscrowed
        );
        address trader = asyncOrderClaim.owner;
        MarketConfiguration.Data storage config;

        (finalOrderAmount, fees, config) = MarketConfiguration.quoteSellExactIn(
            marketId,
            synthAmount,
            price,
            trader,
            Transaction.Type.ASYNC_SELL
        );

        // remove settlment reward from final order
        finalOrderAmount -= settlementReward;

        // check slippage tolerance
        if (finalOrderAmount < asyncOrderClaim.minimumSettlementAmount) {
            revert MinimumSettlementAmountNotMet(
                asyncOrderClaim.minimumSettlementAmount,
                finalOrderAmount
            );
        }

        AsyncOrder.burnFromEscrow(marketId, asyncOrderClaim.amountEscrowed);

        // collect fees
        collectedFees = config.collectFees(
            marketId,
            fees,
            trader,
            asyncOrderClaim.referrer,
            spotMarketFactory,
            Transaction.Type.ASYNC_SELL
        );

        if (settlementReward > 0) {
            spotMarketFactory.synthetix.withdrawMarketUsd(marketId, msg.sender, settlementReward);
        }

        spotMarketFactory.synthetix.withdrawMarketUsd(marketId, trader, finalOrderAmount);
    }

    /**
     * @dev logic for settling an offchain order
     */
    function _settleOffchain(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data storage asyncOrderClaim,
        SettlementStrategy.Data storage settlementStrategy
    )
        private
        view
        returns (
            /* settling offchain reverts with OffchainLookup */
            // solc-ignore-next-line unused-param
            uint256 finalOrderAmount,
            // solc-ignore-next-line unused-param
            OrderFees.Data memory fees
        )
    {
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
            abi.encodePacked(
                settlementStrategy.feedId,
                _getTimeInBytes(asyncOrderClaim.settlementTime)
            ),
            selector,
            abi.encode(marketId, asyncOrderId) // extraData that gets sent to callback for validation
        );
    }

    function _performClaimValidityChecks(
        uint128 marketId,
        uint128 asyncOrderId
    )
        private
        view
        returns (
            AsyncOrderClaim.Data storage asyncOrderClaim,
            SettlementStrategy.Data storage settlementStrategy
        )
    {
        asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        asyncOrderClaim.checkClaimValidity();

        settlementStrategy = AsyncOrderConfiguration.load(marketId).settlementStrategies[
            asyncOrderClaim.settlementStrategyId
        ];
        asyncOrderClaim.checkWithinSettlementWindow(settlementStrategy);
    }

    function _getTimeInBytes(uint256 settlementTime) private pure returns (bytes8 time) {
        bytes32 settlementTimeBytes = bytes32(abi.encode(settlementTime));

        // get last 8 bytes
        return bytes8(settlementTimeBytes << 192);
    }

    // borrowed from PythNode.sol
    function _getScaledPrice(int64 price, int32 expo) private pure returns (int256 scaledPrice) {
        int256 factor = PRECISION + expo;
        return factor > 0 ? price.upscale(factor.toUint()) : price.downscale((-factor).toUint());
    }
}
