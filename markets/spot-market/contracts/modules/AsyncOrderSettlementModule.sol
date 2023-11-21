//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256, SafeCastU256, SafeCastI64, SafeCastU64} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {IAsyncOrderSettlementModule} from "../interfaces/IAsyncOrderSettlementModule.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {IPythERC7412Wrapper} from "../interfaces/external/IPythERC7412Wrapper.sol";
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
    using SafeCastI64 for int64;
    using SafeCastU64 for uint64;
    using SafeCastU256 for uint256;
    using DecimalMath for uint256;
    using DecimalMath for int64;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using SettlementStrategy for SettlementStrategy.Data;
    using MarketConfiguration for MarketConfiguration.Data;
    using AsyncOrder for AsyncOrder.Data;
    using AsyncOrderClaim for AsyncOrderClaim.Data;

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

        uint256 price;

        if (settlementStrategy.strategyType == SettlementStrategy.Type.PYTH) {
            price = IPythERC7412Wrapper(settlementStrategy.priceVerificationContract)
                .getBenchmarkPrice(settlementStrategy.feedId, asyncOrderClaim.commitmentTime.to64())
                .toUint();
        } else {
            price = Price.getCurrentPrice(
                marketId,
                asyncOrderClaim.orderType,
                Price.Tolerance.STRICT
            );
        }

        return _settleOrder(marketId, asyncOrderId, price, asyncOrderClaim, settlementStrategy);
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
            ERC2771Context._msgSender(),
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
            ITokenModule(spotMarketFactory.usdToken).transfer(
                ERC2771Context._msgSender(),
                settlementReward
            );
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
            spotMarketFactory.synthetix.withdrawMarketUsd(
                marketId,
                ERC2771Context._msgSender(),
                settlementReward
            );
        }

        spotMarketFactory.synthetix.withdrawMarketUsd(marketId, trader, finalOrderAmount);
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
}
