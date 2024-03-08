//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {SpotMarketFactory} from "../storage/SpotMarketFactory.sol";
import {AsyncOrderClaim} from "../storage/AsyncOrderClaim.sol";
import {SettlementStrategy} from "../storage/SettlementStrategy.sol";
import {Transaction} from "../utils/TransactionUtil.sol";
import {AsyncOrderConfiguration} from "../storage/AsyncOrderConfiguration.sol";
import {AsyncOrder} from "../storage/AsyncOrder.sol";
import {Price} from "../storage/Price.sol";
import {IAsyncOrderModule} from "../interfaces/IAsyncOrderModule.sol";

/**
 * @title Module to process asyncronous orders
 * @notice See README.md for an overview of asyncronous orders
 * @dev See IAsyncOrderModule.
 */
contract AsyncOrderModule is IAsyncOrderModule {
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using AsyncOrderClaim for AsyncOrderClaim.Data;
    using AsyncOrderConfiguration for AsyncOrderConfiguration.Data;
    using SettlementStrategy for SettlementStrategy.Data;

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function commitOrder(
        uint128 marketId,
        Transaction.Type orderType,
        uint256 amountProvided,
        uint256 settlementStrategyId,
        uint256 minimumSettlementAmount,
        address referrer
    ) external override returns (AsyncOrderClaim.Data memory asyncOrderClaim) {
        // validation checks
        Transaction.validateAsyncTransaction(orderType);
        SpotMarketFactory.load().validateMarket(marketId);
        AsyncOrderConfiguration.Data storage asyncOrderConfiguration = AsyncOrderConfiguration.load(
            marketId
        );
        SettlementStrategy.Data storage strategy = asyncOrderConfiguration
            .validateSettlementStrategy(settlementStrategyId);

        uint256 amountEscrowed;
        // setup data to create async order based on transaction type
        if (orderType == Transaction.Type.ASYNC_BUY) {
            strategy.validateAmount(amountProvided);
            SpotMarketFactory.load().usdToken.transferFrom(
                ERC2771Context._msgSender(),
                address(this),
                amountProvided
            );

            amountEscrowed = amountProvided;
        } else if (orderType == Transaction.Type.ASYNC_SELL) {
            // Get the dollar value of the provided synths
            uint256 currentPrice = Price.getCurrentPrice(
                marketId,
                Transaction.Type.ASYNC_SELL,
                Price.Tolerance.STRICT
            );
            uint256 usdAmount = amountProvided.mulDecimal(currentPrice);

            // ensures that the amount provided is greater than the settlement reward + minimum sell amount
            strategy.validateAmount(usdAmount);
            // using escrow in case of decaying token value
            amountEscrowed = AsyncOrder.transferIntoEscrow(
                marketId,
                ERC2771Context._msgSender(),
                amountProvided,
                strategy.maxRoundingLoss
            );
        }

        asyncOrderClaim = AsyncOrderClaim.create(
            marketId,
            orderType,
            amountEscrowed,
            settlementStrategyId,
            minimumSettlementAmount,
            ERC2771Context._msgSender(),
            referrer
        );

        emit OrderCommitted(
            marketId,
            orderType,
            amountProvided,
            asyncOrderClaim.id,
            ERC2771Context._msgSender(),
            referrer
        );
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    function cancelOrder(uint128 marketId, uint128 asyncOrderId) external override {
        AsyncOrderClaim.Data storage asyncOrderClaim = AsyncOrderClaim.load(marketId, asyncOrderId);
        asyncOrderClaim.checkClaimValidity();
        asyncOrderClaim.validateCancellationEligibility(
            AsyncOrderConfiguration.load(marketId).settlementStrategies[
                asyncOrderClaim.settlementStrategyId
            ]
        );

        _issueRefund(marketId, asyncOrderId, asyncOrderClaim);
    }

    /**
     * @inheritdoc IAsyncOrderModule
     */
    // solc-ignore-next-line func-mutability
    function getAsyncOrderClaim(
        uint128 marketId,
        uint128 asyncOrderId
    ) external pure override returns (AsyncOrderClaim.Data memory asyncOrderClaim) {
        return AsyncOrderClaim.load(marketId, asyncOrderId);
    }

    /**
     * @dev used for cancel orders
     */
    function _issueRefund(
        uint128 marketId,
        uint128 asyncOrderId,
        AsyncOrderClaim.Data storage asyncOrderClaim
    ) private {
        address trader = asyncOrderClaim.owner;

        // claim is no longer valid
        asyncOrderClaim.settledAt = block.timestamp;

        // Return escrowed funds
        if (asyncOrderClaim.orderType == Transaction.Type.ASYNC_BUY) {
            ITokenModule(SpotMarketFactory.load().usdToken).transfer(
                trader,
                asyncOrderClaim.amountEscrowed
            );
        } else if (asyncOrderClaim.orderType == Transaction.Type.ASYNC_SELL) {
            AsyncOrder.transferFromEscrow(marketId, trader, asyncOrderClaim.amountEscrowed);
        }

        emit OrderCancelled(marketId, asyncOrderId, asyncOrderClaim, trader);
    }
}
